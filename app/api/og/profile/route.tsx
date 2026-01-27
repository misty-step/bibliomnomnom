/* eslint-disable design-tokens/no-raw-design-values, @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { log } from "@/lib/api/log";

export const runtime = "edge";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// OG image dimensions (Twitter/FB friendly)
const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return new Response("Missing username", { status: 400 });
  }

  try {
    const profile = await convex.query(api.profiles.getPublic, { username });

    if (!profile) {
      return notFoundImage();
    }

    const displayName = profile.displayName || profile.username;
    const pagesInK = Math.round(profile.stats.pagesRead / 1000);
    const tasteTagline = profile.insights?.tasteTagline;
    const genres = profile.insights?.literaryTaste?.genres?.slice(0, 3) || [];

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FDFBF7", // canvas-bone
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Subtle paper texture effect via noise */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "60px",
            maxWidth: "1000px",
          }}
        >
          {/* Avatar */}
          {profile.avatarUrl && (
            <img
              src={profile.avatarUrl}
              alt=""
              width={120}
              height={120}
              style={{
                borderRadius: "60px",
                marginBottom: "32px",
                border: "4px solid rgba(0,0,0,0.1)",
              }}
            />
          )}

          {/* Name */}
          <div
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#1A1A1A", // text-ink
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {displayName}
          </div>

          {/* Tagline */}
          {tasteTagline && (
            <div
              style={{
                fontSize: "24px",
                fontStyle: "italic",
                color: "#666666", // text-inkMuted
                marginBottom: "40px",
                textAlign: "center",
                maxWidth: "800px",
              }}
            >
              &ldquo;{tasteTagline}&rdquo;
            </div>
          )}

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "64px",
              marginBottom: "40px",
            }}
          >
            <StatBox value={String(profile.stats.booksRead)} label="books read" />
            <StatBox value={`${pagesInK}k`} label="pages" />
            <StatBox value={profile.stats.averagePace.toFixed(1)} label="books/month" />
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {genres.map((genre) => (
                <div
                  key={genre}
                  style={{
                    backgroundColor: "rgba(0,0,0,0.05)",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "18px",
                    color: "#1A1A1A",
                  }}
                >
                  {genre}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer branding */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "16px",
            color: "#999999",
          }}
        >
          <span>bibliomnomnom</span>
        </div>
      </div>,
      {
        width: WIDTH,
        height: HEIGHT,
      },
    );
  } catch (error) {
    log("error", "og_profile_generation_failed", {
      error: error instanceof Error ? error.message : String(error),
      username,
    });
    return errorImage();
  }
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: "40px",
          fontWeight: 700,
          color: "#1A1A1A",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "18px",
          color: "#666666",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function notFoundImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FDFBF7",
      }}
    >
      <div style={{ fontSize: "48px", fontWeight: 700, color: "#1A1A1A" }}>Profile Not Found</div>
      <div style={{ fontSize: "24px", color: "#666666", marginTop: "16px" }}>bibliomnomnom</div>
    </div>,
    { width: WIDTH, height: HEIGHT },
  );
}

function errorImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FDFBF7",
      }}
    >
      <div style={{ fontSize: "48px", fontWeight: 700, color: "#1A1A1A" }}>bibliomnomnom</div>
      <div style={{ fontSize: "24px", color: "#666666", marginTop: "16px" }}>Reader Profile</div>
    </div>,
    { width: WIDTH, height: HEIGHT },
  );
}
