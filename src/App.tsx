import { createSignal, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type Vault = {
  entries: {
    title: string;
    password: string;
    username?: string;
    url?: string;
    notes?: string;
    tags: string[];
  }[];
  created_at: number;
};

type VaultError =
  | { type: "InvalidPassword" }
  | { type: "VaultNotFound" }
  | { type: "CorruptedVault" }
  | { type: "CryptoError" };

function App() {
  const [vault, setVault] = createSignal<Vault | null>(null);
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  async function load_vault() {
    try {
      const result = await invoke<Vault>("load_vault", {
        password: password(),
      });

      setVault(result);
      setError(null);
    } catch (err) {
      setError(mapError(err));
    }
  }

  async function create_vault() {
    try {
      const result = await invoke<Vault>("create_vault", {
        password: password(),
      });

      setVault(result);
      setError(null);
    } catch (err) {
      setError(mapError(err));
    }
  }

  function mapError(err: any) {
    const e = err as VaultError;

    switch (e.type) {
      case "InvalidPassword":
        return "Wrong Password 🔒";
      case "VaultNotFound":
        return "No vault found. Create one first.";
      case "CorruptedVault":
        return "Vault is corrupted.";
      case "CryptoError":
        return "Encryption error occurred.";
      default:
        return "Something went wrong.";
    }
  }

  return (
    <main class="container">
      <h1>Vault</h1>
      <form class="row">
        <input
          id="greet-input"
          onInput={(e) => {
            setPassword(e.currentTarget.value);
            setError(null);
          }}
          placeholder="Enter your password..."
        />
        <button type="button" onClick={load_vault}>
          Load Vault
        </button>
        <button type="button" onClick={create_vault}>
          Create Vault
        </button>
      </form>
      <Show when={error()}>
        <p style={{ color: "red" }}>{error()}</p>
      </Show>
      <Show when={vault()}>
        <pre>{JSON.stringify(vault(), null, 2)}</pre>
      </Show>
    </main>
  );
}

export default App;
