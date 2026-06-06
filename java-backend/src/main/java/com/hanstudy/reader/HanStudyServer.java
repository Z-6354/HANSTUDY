package com.hanstudy.reader;

import com.google.gson.Gson;
import com.hanstudy.reader.config.DataPaths;
import com.hanstudy.reader.model.Annotation;
import com.hanstudy.reader.service.AnnotationService;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.util.HashMap;
import java.util.Map;

public class HanStudyServer {
    private static final Gson GSON = new Gson();
    private static final int PORT = 17890;

    private final AnnotationService annotationService;
    private Javalin app;

    public HanStudyServer() {
        DataPaths dataPaths = new DataPaths();
        this.annotationService = new AnnotationService(dataPaths);
    }

    public void start() {
        app = Javalin.create(config -> config.showJavalinBanner = false)
                .get("/health", ctx -> ctx.json(Map.of("status", "ok")))
                .get("/api/annotations", this::listAnnotations)
                .post("/api/annotations", this::createAnnotation)
                .patch("/api/annotations/{id}", this::updateAnnotation)
                .delete("/api/annotations/{id}", this::deleteAnnotation)
                .get("/api/annotations/export", this::exportAnnotations)
                .post("/shutdown", ctx -> {
                    ctx.status(200).result("ok");
                    new Thread(() -> {
                        try {
                            Thread.sleep(100);
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                        }
                        stop();
                        System.exit(0);
                    }).start();
                })
                .start("127.0.0.1", PORT);
        System.out.println("HAN Study Java backend listening on 127.0.0.1:" + PORT);
    }

    public void stop() {
        if (app != null) {
            app.stop();
            app = null;
        }
    }

    private void listAnnotations(Context ctx) {
        String docPath = ctx.queryParam("docPath");
        if (docPath == null || docPath.isBlank()) {
            ctx.status(400).json(error("docPath is required"));
            return;
        }
        ctx.json(annotationService.list(docPath));
    }

    private void createAnnotation(Context ctx) {
        Annotation input = GSON.fromJson(ctx.body(), Annotation.class);
        if (input == null || input.docPath == null || input.type == null) {
            ctx.status(400).json(error("invalid annotation payload"));
            return;
        }
        ctx.json(annotationService.create(input));
    }

    private void updateAnnotation(Context ctx) {
        String id = ctx.pathParam("id");
        Annotation patch = GSON.fromJson(ctx.body(), Annotation.class);
        Annotation updated = annotationService.update(id, patch);
        if (updated == null) {
            ctx.status(404).json(error("annotation not found"));
            return;
        }
        ctx.json(updated);
    }

    private void deleteAnnotation(Context ctx) {
        String id = ctx.pathParam("id");
        boolean ok = annotationService.delete(id);
        if (!ok) {
            ctx.status(404).json(error("annotation not found"));
            return;
        }
        ctx.json(Map.of("ok", true));
    }

    private void exportAnnotations(Context ctx) {
        String docPath = ctx.queryParam("docPath");
        if (docPath == null || docPath.isBlank()) {
            ctx.status(400).json(error("docPath is required"));
            return;
        }
        ctx.contentType("text/plain; charset=utf-8");
        ctx.result(annotationService.exportMarkdown(docPath));
    }

    private Map<String, String> error(String message) {
        Map<String, String> map = new HashMap<>();
        map.put("error", message);
        return map;
    }

    public static void main(String[] args) {
        new HanStudyServer().start();
    }
}
