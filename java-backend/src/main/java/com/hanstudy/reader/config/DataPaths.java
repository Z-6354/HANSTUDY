package com.hanstudy.reader.config;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class DataPaths {
    private final Path userDataRoot;

    public DataPaths() {
        String env = System.getenv("HANSTUDY_USER_DATA");
        if (env == null || env.isBlank()) {
            throw new IllegalStateException("HANSTUDY_USER_DATA environment variable is required");
        }
        this.userDataRoot = Paths.get(env);
    }

    public Path dataDir() {
        Path dir = userDataRoot.resolve("data");
        try {
            Files.createDirectories(dir);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot create data directory: " + dir, e);
        }
        return dir;
    }

    public Path annotationsFile() {
        return dataDir().resolve("annotations.json");
    }
}
