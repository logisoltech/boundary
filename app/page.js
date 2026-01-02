"use client";

import { useEffect, useRef, useState } from "react";
import cv from "opencv-ts";

function downscaleIfNeeded(src, maxDim = 1200) {
  const w = src.cols;
  const h = src.rows;
  const maxSide = Math.max(w, h);
  if (maxSide <= maxDim) return src;

  const scale = maxDim / maxSide;
  const dsize = new cv.Size(Math.round(w * scale), Math.round(h * scale));
  const resized = new cv.Mat();
  cv.resize(src, resized, dsize, 0, 0, cv.INTER_AREA);
  src.delete();
  return resized;
}

export default function Home() {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const objectUrlRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [step, setStep] = useState(12);
  const [canny1, setCanny1] = useState(80);
  const [canny2, setCanny2] = useState(160);

  useEffect(() => {
    // opencv-ts exports cv immediately, but runtime may need a tick in some envs
    const t = setTimeout(() => {
      setReady(true);
    }, 0);

    return () => {
      clearTimeout(t);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    imgRef.current.src = url;
    setStatus("Image loaded. Click 'Detect Contours'.");
  };

  const runContours = () => {
    if (!ready) return;

    const imgEl = imgRef.current;
    const canvasEl = canvasRef.current;

    if (!imgEl?.src) {
      setStatus("Please upload an image first.");
      return;
    }

    setStatus("Processing...");

    setTimeout(() => {
      try {
        let src = cv.imread(imgEl);
        src = downscaleIfNeeded(src, 1200);

        const dst = src.clone();

        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const blur = new cv.Mat();
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        const edges = new cv.Mat();
        cv.Canny(blur, edges, Number(canny1), Number(canny2));

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();

        // ✅ SIMPLE avoids huge point arrays
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const MAX_PLOT_POINTS = 3000;
        const stride = Math.max(1, Number(step));

        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);

          cv.drawContours(dst, contours, i, new cv.Scalar(0, 255, 0, 255), 2);

          let plotted = 0;
          for (let j = 0; j < cnt.rows; j += stride) {
            if (plotted++ > MAX_PLOT_POINTS) break;

            const x = cnt.intPtr(j, 0)[0];
            const y = cnt.intPtr(j, 0)[1];
            cv.circle(dst, new cv.Point(x, y), 2, new cv.Scalar(255, 0, 0, 255), -1);
          }

          cnt.delete();
        }

        canvasEl.width = dst.cols;
        canvasEl.height = dst.rows;
        cv.imshow(canvasEl, dst);

        src.delete();
        dst.delete();
        gray.delete();
        blur.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();

        setStatus(`Done. Contours found: ${contours.size()}`);
      } catch (err) {
        console.error(err);
        setStatus(`Processing error: ${err.message}`);
      }
    }, 0);
  };

  return (
    <main style={{ 
      padding: "32px 24px", 
      color: "#e5e7eb", 
      background: "#000000", 
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ 
          fontSize: "32px", 
          marginBottom: "8px",
          fontWeight: 600,
          color: "#10b981",
          letterSpacing: "-0.5px"
        }}>
          EdgeScan Contours
        </h1>
        <p style={{ 
          fontSize: "14px", 
          marginBottom: "32px",
          color: "#9ca3af",
          fontWeight: 400
        }}>
          Point Plotting & Edge Detection
        </p>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ 
            width: "360px", 
            background: "#0a0a0a", 
            border: "1px solid #1a1a1a", 
            borderRadius: "16px", 
            padding: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
          }}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ 
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#10b981",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Upload Image
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={onFile} 
                disabled={!ready}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#10b981",
                  border: "1px solid #059669",
                  borderRadius: "8px",
                  color: "#000000",
                  fontSize: "13px",
                  cursor: ready ? "pointer" : "not-allowed",
                  opacity: ready ? 1 : 0.5,
                  transition: "all 0.2s ease",
                  fontWeight: 500
                }}
              />
            </div>

            <div style={{ marginTop: "24px", marginBottom: "20px" }}>
              <label style={{ 
                display: "block",
                fontSize: "12px", 
                fontWeight: 500,
                color: "#d1d5db",
                marginBottom: "8px"
              }}>
                Plot every Nth point: <span style={{ color: "#10b981", fontWeight: 600 }}>{step}</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="30" 
                value={step} 
                onChange={(e) => setStep(e.target.value)} 
                disabled={!ready}
                style={{ 
                  width: "100%",
                  accentColor: "#10b981",
                  cursor: ready ? "pointer" : "not-allowed",
                  opacity: ready ? 1 : 0.5
                }} 
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ 
                display: "block",
                fontSize: "12px", 
                fontWeight: 500,
                color: "#d1d5db",
                marginBottom: "8px"
              }}>
                Canny threshold1: <span style={{ color: "#10b981", fontWeight: 600 }}>{canny1}</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="300" 
                value={canny1} 
                onChange={(e) => setCanny1(e.target.value)} 
                disabled={!ready}
                style={{ 
                  width: "100%",
                  accentColor: "#10b981",
                  cursor: ready ? "pointer" : "not-allowed",
                  opacity: ready ? 1 : 0.5
                }} 
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ 
                display: "block",
                fontSize: "12px", 
                fontWeight: 500,
                color: "#d1d5db",
                marginBottom: "8px"
              }}>
                Canny threshold2: <span style={{ color: "#10b981", fontWeight: 600 }}>{canny2}</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="400" 
                value={canny2} 
                onChange={(e) => setCanny2(e.target.value)} 
                disabled={!ready}
                style={{ 
                  width: "100%",
                  accentColor: "#10b981",
                  cursor: ready ? "pointer" : "not-allowed",
                  opacity: ready ? 1 : 0.5
                }} 
              />
            </div>

            <button
              onClick={runContours}
              disabled={!ready}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: ready ? "#10b981" : "#1a1a1a",
                color: ready ? "#000000" : "#4b5563",
                fontWeight: 600,
                fontSize: "14px",
                cursor: ready ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                boxShadow: ready ? "0 4px 14px 0 rgba(16, 185, 129, 0.2)" : "none",
                transform: ready ? "translateY(0)" : "none"
              }}
              onMouseEnter={(e) => {
                if (ready) {
                  e.target.style.background = "#059669";
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.boxShadow = "0 6px 20px 0 rgba(16, 185, 129, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (ready) {
                  e.target.style.background = "#10b981";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 14px 0 rgba(16, 185, 129, 0.2)";
                }
              }}
            >
              Detect Contours
            </button>

            <img ref={imgRef} alt="" style={{ display: "none" }} onLoad={() => setStatus("Image loaded. Click 'Detect Contours'.")} />
          </div>

          <div style={{ flex: 1, minWidth: "400px" }}>
            <div style={{
              background: "#0a0a0a",
              border: "1px solid #1a1a1a",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
            }}>
              <canvas 
                ref={canvasRef} 
                style={{ 
                  width: "100%",
                  height: "auto",
                  borderRadius: "8px",
                  background: "#000000",
                  display: "block"
                }} 
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
