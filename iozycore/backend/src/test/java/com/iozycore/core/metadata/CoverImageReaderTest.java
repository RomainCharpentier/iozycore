package com.iozycore.core.metadata;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetSocketAddress;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/** A cover URL can be typed by hand: this list is what keeps the server from calling any address. */
class CoverImageReaderTest {

    @Test
    void a_known_cover_host_is_called_in_https() {
        assertThat(CoverImageReader.allowedCoverUri("http://cf.geekdo-images.com/a/b.jpg?x=1"))
                .hasValueSatisfying(uri -> assertThat(uri.toString()).isEqualTo("https://cf.geekdo-images.com/a/b.jpg?x=1"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost:8080/api/admin",
            "http://169.254.169.254/latest/meta-data",
            "https://postgres:5432/",
            "https://cf.geekdo-images.com.evil.test/a.jpg",
            "https://cf.geekdo-images.com@evil.test/a.jpg",
            "https://evil.test@cf.geekdo-images.com/a.jpg",
            "https://cf.geekdo-images.com:8443/a.jpg",
            "file:///etc/passwd",
            "not a url"
    })
    void anything_else_is_refused(String url) {
        assertThat(CoverImageReader.allowedCoverUri(url)).isEmpty();
    }

    /** A 5xx of a CDN is a host in trouble; a closed port is a host that does not answer. */
    @Test
    void a_500_off_the_bnf_and_a_closed_port_are_unreachable() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        server.start();
        int port = server.getAddress().getPort();
        try {
            CoverImageReader reader = new CoverImageReader();
            // Not the BnF host: a 500 is a host in trouble. (The BnF case is the host name, see fetch.)
            assertThat(reader.fetch(URI.create("http://127.0.0.1:" + port + "/couverture")))
                    .isInstanceOf(CoverImageReader.Unreachable.class);
        } finally {
            server.stop(0);
        }
        assertThat(new CoverImageReader().fetch(URI.create("http://127.0.0.1:" + port + "/couverture")))
                .isInstanceOf(CoverImageReader.Unreachable.class);
    }
}
