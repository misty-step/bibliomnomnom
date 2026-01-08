/* eslint-disable design-tokens/no-raw-design-values */
import { ImageResponse } from "next/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FDFBF7", // canvas-bone
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle dot pattern texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='black'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Book icon */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1A1A1A"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "32px", opacity: 0.6 }}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>

          {/* Title */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#1A1A1A", // text-ink
              letterSpacing: "-2px",
              marginBottom: "16px",
            }}
          >
            bibliomnomnom
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "28px",
              color: "#666666", // text-inkMuted
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            for voracious readers
          </div>
        </div>

        {/* Decorative bottom line */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            width: "100px",
            height: "2px",
            backgroundColor: "#1A1A1A",
            opacity: 0.2,
          }}
        />
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
