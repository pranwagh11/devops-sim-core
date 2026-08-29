import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// --- honest framing ---------------------------------------------------
// This is a client-side access gate, not real authentication. The
// encrypted blob, the derivation parameters, and all the code that checks
// them ship in the browser bundle — anyone can inspect them. What this
// DOES provide, unlike a plain `if (password === "admin123")` check: the
// stored value is genuinely encrypted with AES-GCM, so the correct key
// isn't sitting in the source as readable text, and a wrong key fails
// decryption outright (it doesn't just fail an equality check) rather
// than being trivially spotted by reading the code. It raises the bar
// above a visible plaintext comparison, but it does not stop someone
// willing to brute-force the passphrase against the shipped blob offline.
// Real access control requires a server-side secret — see the "backend"
// phase of the architecture doc for that.
//
// This app never generates or stores a key. The encrypted credential
// (salt + iv + ciphertext) is produced entirely offline by the separate
// tool at tools/admin-credential-generator.html and shipped as a static
// file at public/admin-seed.json. This app's only job is to load that
// file and attempt to decrypt it with whatever key the person types in.

interface AdminBlob {
  salt: string; // base64
  iv: string; // base64
  cipher: string; // base64 — AES-GCM ciphertext of the admin username
}

let cachedBlob: AdminBlob | null | undefined; // undefined = not yet loaded, null = load failed/missing

async function loadAdminBlob(): Promise<AdminBlob | null> {
  if (cachedBlob !== undefined) return cachedBlob;
  try {
    const url = new URL(`${import.meta.env.BASE_URL}admin-seed.json`, document.baseURI).toString();
    const res = await fetch(url);
    if (!res.ok) {
      cachedBlob = null;
      return null;
    }
    cachedBlob = (await res.json()) as AdminBlob;
    return cachedBlob;
  } catch {
    cachedBlob = null;
    return null;
  }
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

// Attempts to decrypt the loaded blob with the given passphrase and
// compares the result to the given username. AES-GCM is authenticated —
// a wrong passphrase makes decrypt() throw rather than silently return
// garbage, so a caught exception is itself a clean "wrong key" signal.
async function attemptAdminLogin(username: string, passphrase: string): Promise<boolean> {
  const blob = await loadAdminBlob();
  if (!blob) return false;
  const salt = new Uint8Array(b64ToBuf(blob.salt));
  const iv = new Uint8Array(b64ToBuf(blob.iv));
  const key = await deriveKey(passphrase, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, b64ToBuf(blob.cipher));
    const plain = new TextDecoder().decode(plainBuf);
    return plain === username;
    // The passphrase argument goes out of scope when this function
    // returns and is never stored — this is the "key deleted after
    // login" behavior. Only a session flag persists, set by the caller.
  } catch {
    return false;
  }
}

// --- React context --------------------------------------------------------

const ROLE_SESSION_KEY = "devops-sim-session:role";
export type Role = "admin" | "learner";

interface AuthContextValue {
  role: Role;
  adminAvailable: boolean; // whether admin-seed.json loaded successfully
  login: (username: string, passphrase: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem(ROLE_SESSION_KEY) === "admin" ? "admin" : "learner"));
  const [adminAvailable, setAdminAvailable] = useState(false);

  useEffect(() => {
    loadAdminBlob().then((blob) => setAdminAvailable(!!blob));
  }, []);

  const login = async (username: string, passphrase: string) => {
    const ok = await attemptAdminLogin(username, passphrase);
    if (ok) {
      sessionStorage.setItem(ROLE_SESSION_KEY, "admin");
      setRole("admin");
    }
    return ok;
  };

  const logout = () => {
    sessionStorage.removeItem(ROLE_SESSION_KEY);
    setRole("learner");
  };

  return (
    <AuthContext.Provider value={{ role, adminAvailable, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
