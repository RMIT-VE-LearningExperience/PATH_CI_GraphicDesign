const FOOTER_BG = "#45443F";
const FOOTER_TEXT = "#ffffff";

const linkStyle: React.CSSProperties = { color: "#ffffff", textDecoration: "underline" };

const content = (year: number) => (
  <>
    © {year} Designed by the{" "}
    <a href="mailto:dmd.cove@rmit.edu.au" style={linkStyle}>
      Digital Design &amp; Media Team
    </a>
    {" "}· Learning &amp; Teaching Innovation · RMIT College of Vocational Education
  </>
);

export default function Footer({ year, isAdmin }: { year: number; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <div
        style={{
          width: "100%",
          padding: 0,
          textAlign: "left",
          fontSize: "11px",
          color: "#C2BDB1", // >4.5:1 on the sidebar background
          fontWeight: 400,
          letterSpacing: "0.3px",
          boxSizing: "border-box",
        }}
      >
        {content(year)}
      </div>
    );
  }

  return (
    <footer
      style={{
        width: "100%",
        backgroundColor: FOOTER_BG,
        padding: "10px 24px",
        textAlign: "center",
        fontSize: "14px",
        color: FOOTER_TEXT,
        fontWeight: 500,
        letterSpacing: "0.3px",
        boxSizing: "border-box",
      }}
    >
      {content(year)}
    </footer>
  );
}
