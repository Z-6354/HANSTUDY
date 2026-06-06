package com.hanstudy.reader.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import com.hanstudy.reader.config.DataPaths;
import com.hanstudy.reader.model.Annotation;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class AnnotationService {
    private static final Gson GSON = new GsonBuilder().create();
    private static final Type LIST_TYPE = new TypeToken<List<Annotation>>() {}.getType();

    private final DataPaths dataPaths;

    public AnnotationService(DataPaths dataPaths) {
        this.dataPaths = dataPaths;
    }

    private List<Annotation> readAll() {
        try {
            var path = dataPaths.annotationsFile();
            if (!Files.exists(path)) {
                return new ArrayList<>();
            }
            String raw = Files.readString(path, StandardCharsets.UTF_8);
            if (raw.isBlank()) {
                return new ArrayList<>();
            }
            List<Annotation> list = GSON.fromJson(raw, LIST_TYPE);
            return list != null ? list : new ArrayList<>();
        } catch (IOException e) {
            throw new RuntimeException("Failed to read annotations", e);
        }
    }

    private void writeAll(List<Annotation> annotations) {
        try {
            String json = GSON.toJson(annotations);
            Files.writeString(dataPaths.annotationsFile(), json, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write annotations", e);
        }
    }

    public List<Annotation> list(String docPath) {
        return readAll().stream()
                .filter(a -> docPath.equals(a.docPath))
                .sorted(Comparator.comparing(a -> a.createdAt))
                .collect(Collectors.toList());
    }

    public Annotation create(Annotation input) {
        Annotation annotation = input;
        annotation.id = UUID.randomUUID().toString();
        annotation.createdAt = Instant.now().toString();
        List<Annotation> all = readAll();
        all.add(annotation);
        writeAll(all);
        return annotation;
    }

    public Annotation update(String id, Annotation patch) {
        List<Annotation> all = readAll();
        for (int i = 0; i < all.size(); i++) {
            if (id.equals(all.get(i).id)) {
                Annotation existing = all.get(i);
                if (patch.content != null) existing.content = patch.content;
                if (patch.color != null) existing.color = patch.color;
                if (patch.type != null) existing.type = patch.type;
                if (patch.shape != null) existing.shape = patch.shape;
                all.set(i, existing);
                writeAll(all);
                return existing;
            }
        }
        return null;
    }

    public boolean delete(String id) {
        List<Annotation> all = readAll();
        List<Annotation> next = all.stream()
                .filter(a -> !id.equals(a.id))
                .collect(Collectors.toList());
        if (next.size() == all.size()) {
            return false;
        }
        writeAll(next);
        return true;
    }

    public String exportMarkdown(String docPath) {
        List<Annotation> items = list(docPath);
        String title = docPath.replace('\\', '/');
        int slash = title.lastIndexOf('/');
        if (slash >= 0) {
            title = title.substring(slash + 1);
        }
        StringBuilder sb = new StringBuilder();
        sb.append("# 标注导出：").append(title).append("\n\n");
        sb.append("> 导出时间：").append(Instant.now()).append("\n\n");

        for (Annotation item : items) {
            String label;
            switch (item.type) {
                case "highlight": label = "高亮"; break;
                case "underline": label = "下划线"; break;
                case "pen": label = "画笔"; break;
                case "rect": label = "方框"; break;
                default: label = "便签"; break;
            }
            sb.append("## ").append(label).append("\n");
            if (item.shape != null && item.shape.points != null && !item.shape.points.isEmpty()) {
                sb.append("_手绘 ").append(item.shape.points.size()).append(" 个点_\n\n");
            }
            if (item.shape != null && item.shape.width != null && item.shape.height != null) {
                sb.append("_矩形标注_\n\n");
            }
            if (item.selectedText != null && !item.selectedText.isBlank()) {
                sb.append("\n> ").append(item.selectedText.replace("\n", "\n> ")).append("\n\n");
            }
            if (item.content != null && !item.content.isBlank()) {
                sb.append(item.content).append("\n\n");
            }
            if (item.pdfAnchor != null) {
                sb.append("_PDF 第 ").append(item.pdfAnchor.page).append(" 页_\n\n");
            }
            sb.append("---\n\n");
        }
        return sb.toString();
    }
}
