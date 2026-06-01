"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBanner } from "@/components/ui";

const FIELDS = [
  { key: "username", label: "ชื่อผู้ใช้", type: "text" },
  { key: "email", label: "อีเมล", type: "email" },
  { key: "password", label: "รหัสผ่าน", type: "password" },
];

const ROLES = [
  { value: "viewer", label: "ผู้ชม" },
  { value: "streamer", label: "สตรีมเมอร์" },
];

// Helper function to validate registration input (same as server-side)
function validateRegisterInput(body) {
  const { username, email, password } = body;

  // Validate username: only a-z, A-Z, 0-9, _ allowed
  if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      message: "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร a-z, A-Z, 0-9 และ _ เท่านั้น",
    };
  }

  // Validate email pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { valid: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  // Validate password: at least 8 characters
  if (!password || password.length < 8) {
    return { valid: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  // Validate password: at least 1 number
  if (!/\d/.test(password)) {
    return { valid: false, message: "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว" };
  }

  return { valid: true };
}

// Helper function to calculate password strength
function getPasswordStrength(password) {
  if (!password) return { level: "weak", label: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/\d/.test(password)) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { level: "weak", label: "อ่อน" };
  if (score <= 3) return { level: "medium", label: "ปานกลาง" };
  return { level: "strong", label: "แข็งแรง" };
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "viewer",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");

    // Client-side validation before API call
    const validation = validateRegisterInput(form);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/register", form);
      login(data.token, data.user);
      router.push("/");
    } catch (err) {
      setError(err.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>สมัครสมาชิก</h1>

        <ErrorBanner message={error} />

        {FIELDS.map(({ key, label, type }) => (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>{label}</label>
            <input
              className="input-base"
              type={type}
              value={form[key]}
              onChange={(e) =>
                setForm((p) => ({ ...p, [key]: e.target.value }))
              }
            />
            {key === "password" && form.password && (
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color:
                    passwordStrength.level === "weak"
                      ? "var(--danger)"
                      : passwordStrength.level === "medium"
                        ? "var(--accent)"
                        : "var(--success)",
                }}
              >
                ความแข็งแรงรหัสผ่าน: {passwordStrength.label}
              </div>
            )}
          </div>
        ))}

        {/* Role selector */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>ประเภทบัญชี</label>
          <div style={{ display: "flex", gap: "12px" }}>
            {ROLES.map(({ value, label }) => {
              const active = form.role === value;
              return (
                <label
                  key={value}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-input)"}`,
                    background: active ? "var(--accent-muted)" : "transparent",
                    fontSize: "14px",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    transition: `all var(--transition)`,
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={active}
                    onChange={() => setForm((p) => ({ ...p, role: value }))}
                    style={{ display: "none" }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>

        <p style={footerStyle}>
          มีบัญชีแล้ว?{" "}
          <a href="/login" style={{ color: "var(--accent)" }}>
            เข้าสู่ระบบ
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const centerStyle = {
  minHeight: "80vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const cardStyle = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius)",
  padding: "40px",
  width: "100%",
  maxWidth: "400px",
  border: "1px solid var(--border)",
};
const titleStyle = { fontSize: "22px", fontWeight: 700, marginBottom: "24px" };
const labelStyle = {
  display: "block",
  fontSize: "13px",
  color: "var(--text-muted)",
  marginBottom: "6px",
};
const footerStyle = {
  textAlign: "center",
  marginTop: "20px",
  fontSize: "14px",
  color: "var(--text-muted)",
};
