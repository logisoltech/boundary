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
  const [status, setStatus] = useState("Loading OpenCV...");
  const [step, setStep] = useState(12);
  const [canny1, setCanny1] = useState(80);
  const [canny2, setCanny2] = useState(160);

  useEffect(() => {
    // opencv-ts exports cv immediately, but runtime may need a tick in some envs
    const t = setTimeout(() => {
      setReady(true);
      setStatus("OpenCV ready. Upload an image.");
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
    <main style={{ padding: 20, color: "#e5e7eb", background: "#0f172a", minHeight: "100vh" }}>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>OpenCV.js Contours + Point Plotting</h2>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 320, background: "#020617", border: "1px solid #1e293b", borderRadius: 12, padding: 12 }}>
          <input type="file" accept="image/*" onChange={onFile} disabled={!ready} />
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>{status}</div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12 }}>Plot every Nth point: {step}</label>
            <input type="range" min="1" max="30" value={step} onChange={(e) => setStep(e.target.value)} style={{ width: "100%" }} disabled={!ready} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12 }}>Canny threshold1: {canny1}</label>
            <input type="range" min="0" max="300" value={canny1} onChange={(e) => setCanny1(e.target.value)} style={{ width: "100%" }} disabled={!ready} />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12 }}>Canny threshold2: {canny2}</label>
            <input type="range" min="0" max="400" value={canny2} onChange={(e) => setCanny2(e.target.value)} style={{ width: "100%" }} disabled={!ready} />
          </div>

          <button
            onClick={runContours}
            disabled={!ready}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              border: 0,
              background: ready ? "#22c55e" : "#334155",
              color: "#052e16",
              fontWeight: 700,
              cursor: ready ? "pointer" : "not-allowed",
            }}
          >
            Detect Contours
          </button>

          <img ref={imgRef} alt="" style={{ display: "none" }} onLoad={() => setStatus("Image loaded. Click 'Detect Contours'.")} />
        </div>

        <div>
          <canvas ref={canvasRef} style={{ border: "1px solid #1e293b", borderRadius: 12, background: "#020617" }} />
        </div>
      </div>
    </main>
  );
}
