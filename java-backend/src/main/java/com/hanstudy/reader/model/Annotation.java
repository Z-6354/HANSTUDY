package com.hanstudy.reader.model;

import java.util.List;
import java.util.Map;

public class Annotation {
    public String id;
    public String docPath;
    public String type;
    public String color;
    public String selectedText;
    public String content;
    public TextRange range;
    public PdfAnchor pdfAnchor;
    public DrawShape shape;
    public String createdAt;

    public static class TextRange {
        public int startLine;
        public int startColumn;
        public int endLine;
        public int endColumn;
        public Integer startOffset;
        public Integer endOffset;
    }

    public static class PdfAnchor {
        public int page;
        public double x;
        public double y;
    }

    public static class DrawShape {
        public List<Map<String, Double>> points;
        public Double x;
        public Double y;
        public Double width;
        public Double height;
        public Double strokeWidth;
    }
}
