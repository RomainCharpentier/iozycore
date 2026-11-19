package com.iozycore.core.metadata;

import com.iozycore.core.metadata.CoverImageReader.CoverImage;
import com.iozycore.core.metadata.CoverImageReader.Fetch;
import com.iozycore.core.metadata.CoverImageReader.Found;
import com.iozycore.core.metadata.CoverImageReader.Missing;
import com.iozycore.core.metadata.CoverImageReader.Unreachable;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URI;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/** The BnF blocks an address after a burst: a cover is asked of its host once, and a silent host is left alone. */
class CoverImageStoreTest {

    private static final URI BNF = URI.create("https://catalogue.bnf.fr/couverture?idArk=ark:/12148/cb1&couverture=1");
    private static final URI BNF_OTHER = URI.create("https://catalogue.bnf.fr/couverture?idArk=ark:/12148/cb2&couverture=1");
    private static final CoverImage JPEG = new CoverImage("image/jpeg", new byte[]{1, 2, 3});

    @TempDir
    Path folder;

    /** Answers in order, and counts the calls that reached the host. */
    private static final class FakeHost implements Function<URI, Fetch> {
        final Deque<Fetch> answers = new ArrayDeque<>();
        final List<URI> calls = new ArrayList<>();

        FakeHost answering(Fetch... fetches) {
            answers.addAll(List.of(fetches));
            return this;
        }

        @Override
        public Fetch apply(URI uri) {
            calls.add(uri);
            return answers.isEmpty() ? new Missing() : answers.poll();
        }
    }

    private final MutableClock clock = new MutableClock();

    private CoverImageStore store(FakeHost host) {
        return new CoverImageStore(host, folder, clock, Duration.ZERO, Duration.ofMinutes(5));
    }

    @Test
    void a_cover_read_once_is_served_from_disk_even_after_a_restart() {
        FakeHost host = new FakeHost().answering(new Found(JPEG));
        assertThat(store(host).get(BNF)).hasValueSatisfying(image -> assertThat(image.bytes()).containsExactly(1, 2, 3));

        CoverImageStore afterRestart = store(host);
        assertThat(afterRestart.get(BNF)).hasValueSatisfying(image -> assertThat(image.contentType()).isEqualTo("image/jpeg"));
        assertThat(host.calls).hasSize(1);
    }

    @Test
    void a_silent_host_is_left_alone_for_a_while() {
        FakeHost host = new FakeHost().answering(new Unreachable(), new Found(JPEG));
        CoverImageStore store = store(host);

        assertThat(store.get(BNF)).isEmpty();
        assertThat(store.get(BNF_OTHER)).isEmpty();
        assertThat(host.calls).hasSize(1);

        clock.advance(Duration.ofMinutes(6));
        assertThat(store.get(BNF_OTHER)).isPresent();
    }

    @Test
    void a_cdn_that_times_out_once_is_not_silenced() {
        URI anilist = URI.create("https://s4.anilist.co/file/a.jpg");
        URI other = URI.create("https://s4.anilist.co/file/b.jpg");
        FakeHost host = new FakeHost().answering(new Unreachable(), new Found(JPEG));
        CoverImageStore store = store(host);

        assertThat(store.get(anilist)).isEmpty();
        assertThat(store.get(other)).isPresent();
    }

    @Test
    void a_cover_that_does_not_exist_does_not_silence_its_host() {
        FakeHost host = new FakeHost().answering(new Missing(), new Found(JPEG));
        CoverImageStore store = store(host);

        assertThat(store.get(BNF)).isEmpty();
        assertThat(store.get(BNF)).isEmpty();
        assertThat(store.get(BNF_OTHER)).isPresent();
        // The missing one was asked once, not at every visit.
        assertThat(host.calls).containsExactly(BNF, BNF_OTHER);
    }

    @Test
    void covers_are_still_served_when_no_folder_can_keep_them() throws Exception {
        Path aFile = java.nio.file.Files.createFile(folder.resolve("not-a-folder"));
        FakeHost host = new FakeHost().answering(new Found(JPEG));
        CoverImageStore store = new CoverImageStore(host, aFile, clock, Duration.ZERO, Duration.ofMinutes(5));

        assertThat(store.get(BNF)).isPresent();
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-19T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }
}
