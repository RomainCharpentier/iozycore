package com.iozycore.core.metadata;

import com.iozycore.core.metadata.CoverImageReader.CoverImage;
import com.iozycore.core.metadata.CoverImageReader.Fetch;
import com.iozycore.core.metadata.CoverImageReader.Found;
import com.iozycore.core.metadata.CoverImageReader.Missing;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * The covers served from this origin, each one fetched from its host ONCE.
 *
 * <h2>Why</h2>
 * The BnF drops every connection of an address after a burst of a few dozen
 * requests, for about a quarter of an hour. A wall or a long series asks for
 * dozens of its covers at once, from the browser, at every visit: the covers
 * went missing, then the fallback letter showed until the block ended.
 *
 * <h2>How</h2>
 * <ul>
 *   <li>A cover read once is kept on disk (the media volume): a cover never
 *       changes at the same address, so it never expires.</li>
 *   <li>Calls to one host go two at a time, and at least {@code spacing}
 *       apart for the BnF: the first visit of a long series fills slowly
 *       instead of getting the address blocked.</li>
 *   <li>A host that does not answer is left alone for a few minutes: asking
 *       again during a block would only make it last.</li>
 *   <li>An address that answers "no image" is remembered for a day.</li>
 * </ul>
 * The media volume of an install made before this class can belong to root:
 * the covers are then kept in a temporary folder, until the container is
 * recreated. Without any writable folder, covers are still served, just not kept.
 */
@Component
@Slf4j
public class CoverImageStore {

    static final String BNF_HOST = "catalogue.bnf.fr";
    private static final Duration WAIT_FOR_A_TURN = Duration.ofSeconds(20);
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp", "image/gif", "gif");

    private final Function<URI, Fetch> fetcher;
    private final Path folder;
    /** The folder in use: the configured one, or a temporary one when it is not writable. */
    private volatile Path activeFolder;
    private final Clock clock;
    private final Duration bnfSpacing;
    private final Duration hostCooldown;
    private final Map<String, Semaphore> turns = new ConcurrentHashMap<>();
    private final Map<String, Instant> nextCall = new ConcurrentHashMap<>();
    private final Map<String, Instant> silentUntil = new ConcurrentHashMap<>();
    private final TtlCache<String, Boolean> missing = new TtlCache<>(Duration.ofDays(1), 5_000);

    @Autowired
    public CoverImageStore(CoverImageReader reader,
                           @Value("${iozycore.covers.cache-dir:/app/media/covers}") String folder) {
        this(reader::fetch, Path.of(folder), Clock.systemUTC(), Duration.ofMillis(400), Duration.ofMinutes(5));
    }

    CoverImageStore(Function<URI, Fetch> fetcher, Path folder, Clock clock, Duration bnfSpacing, Duration hostCooldown) {
        this.fetcher = fetcher;
        this.folder = folder;
        this.activeFolder = folder;
        this.clock = clock;
        this.bnfSpacing = bnfSpacing;
        this.hostCooldown = hostCooldown;
    }

    /** The cover, from disk when it was read before; empty: the page shows its fallback. */
    public Optional<CoverImage> get(URI uri) {
        String key = key(uri);
        Optional<CoverImage> kept = activeFolder == null ? Optional.empty() : fromDisk(key);
        if (kept.isPresent()) {
            return kept;
        }
        if (missing.get(key).isPresent() || isSilent(uri.getHost())) {
            return Optional.empty();
        }
        Fetch fetch = inTurn(uri);
        if (fetch instanceof Found found) {
            toDisk(key, found.image());
            return Optional.of(found.image());
        }
        if (fetch instanceof Missing) {
            missing.put(key, true);
        } else if (fetch != null) {
            silentUntil.put(uri.getHost(), clock.instant().plus(hostCooldown));
            log.warn("Cover host {} does not answer: left alone for {}", uri.getHost(), hostCooldown);
        }
        return Optional.empty();
    }

    private boolean isSilent(String host) {
        Instant until = silentUntil.get(host);
        return until != null && clock.instant().isBefore(until);
    }

    /** One call, when the host gives this one its turn; null when no turn came in time. */
    private Fetch inTurn(URI uri) {
        String host = uri.getHost();
        Semaphore turn = turns.computeIfAbsent(host, h -> new Semaphore(2, true));
        try {
            if (!turn.tryAcquire(WAIT_FOR_A_TURN.toMillis(), TimeUnit.MILLISECONDS)) {
                return null;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        try {
            if (isSilent(host)) {
                return null;
            }
            if (BNF_HOST.equals(host)) {
                waitForSlot(host);
            }
            return fetcher.apply(uri);
        } finally {
            turn.release();
        }
    }

    private void waitForSlot(String host) {
        Instant now = clock.instant();
        Instant slot = nextCall.merge(host, now.plus(bnfSpacing),
                (previous, ignored) -> (previous.isAfter(now) ? previous : now).plus(bnfSpacing))
                .minus(bnfSpacing);
        long waitMs = Duration.between(now, slot).toMillis();
        if (waitMs > 0) {
            try {
                Thread.sleep(waitMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private Optional<CoverImage> fromDisk(String key) {
        for (Map.Entry<String, String> type : EXTENSIONS.entrySet()) {
            Path file = activeFolder.resolve(key + "." + type.getValue());
            if (Files.isRegularFile(file)) {
                try {
                    return Optional.of(new CoverImage(type.getKey(), Files.readAllBytes(file)));
                } catch (IOException e) {
                    log.warn("Kept cover not readable: {} ({})", file, e.getMessage());
                }
            }
        }
        return Optional.empty();
    }

    private void toDisk(String key, CoverImage image) {
        String extension = EXTENSIONS.get(image.contentType());
        Path target = activeFolder;
        if (target == null || extension == null) {
            return;
        }
        try {
            write(target, key + "." + extension, image.bytes());
        } catch (IOException | UnsupportedOperationException e) {
            Path fallback = Path.of(System.getProperty("java.io.tmpdir"), "iozycore-covers");
            if (!target.equals(folder) || fallback.equals(folder)) {
                activeFolder = null;
                log.warn("Covers are served but not kept: {} is not writable ({})", target, e.getMessage());
                return;
            }
            log.warn("{} is not writable ({}): covers kept in {} until the container is recreated",
                    folder, e.getMessage(), fallback);
            activeFolder = fallback;
            toDisk(key, image);
        }
    }

    private static void write(Path target, String name, byte[] bytes) throws IOException {
        Files.createDirectories(target);
        // Written aside then moved: a reader never sees half a file.
        Path partial = Files.createTempFile(target, "cover", ".part");
        try {
            Files.write(partial, bytes);
            Files.move(partial, target.resolve(name), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(partial);
        }
    }

    static String key(URI uri) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(uri.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
