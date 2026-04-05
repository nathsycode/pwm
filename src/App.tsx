import { createSignal, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import "uno.css";

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
    <main class="p-6 max-w-xl mx-auto flex flex-col gap-4">
      <h1 class="text-xl font-bold">Vault</h1>

      <Show
        when={vault()}
        fallback={
          <div class="flex flex-col gap-2">
            <input
              class="border rounded px-2 py-1"
              onInput={(e) => {
                setPassword(e.currentTarget.value);
                setError(null);
              }}
              placeholder="Enter your password..."
            />

            <button
              class="border px-3 py-1 rounded"
              type="button"
              onClick={load_vault}
            >
              Load Vault
            </button>
            <button
              class="border px-3 py-1 rounded"
              type="button"
              onClick={create_vault}
            >
              Create Vault
            </button>
          </div>
        }
      >
        <VaultApp
          vault={vault()!}
          password={password()}
          setVault={setVault}
          setError={setError}
        />
      </Show>
      <Show when={error()}>
        <p style={{ color: "red" }}>{error()}</p>
      </Show>
    </main>
  );
}

function VaultApp(props: {
  vault: Vault;
  password: string;
  setVault: (v: Vault) => void;
  setError: (e: string) => void;
}) {
  const [title, setTitle] = createSignal("");
  const [entryPassword, setEntryPassword] = createSignal("");

  async function add_entry() {
    try {
      const result = await invoke<Vault>("add_entry", {
        password: props.password,
        entry: {
          title: title(),
          password: entryPassword(),
          username: null,
          url: null,
          notes: null,
          tags: [],
        },
      });

      props.setVault(result);

      setTitle("");
      setEntryPassword("");
    } catch (err) {
      props.setError("Failed to add entry");
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2 border p-3 rounded">
        <h2 class="font-semibold">Add Entry</h2>

        <input
          class="border rounded px-2 py-1"
          placeholder="Title"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />

        <input
          class="border rounded px-2 py-1"
          placeholder="Password"
          value={entryPassword()}
          onInput={(e) => setEntryPassword(e.currentTarget.value)}
        />

        <button class="border px-3 py-1 rounded" onClick={add_entry}>
          Add Entry
        </button>
      </div>
      <div class="flex flex-col gap-2">
        <h2 class="font-semibold">Entries</h2>

        <Show
          when={props.vault.entries.length > 0}
          fallback={<p class="text-sm text-gray-500">No entries yet</p>}
        >
          <For each={props.vault.entries}>
            {(entry, index) => (
              <div class="border border-slate-700 p-2 flex flex-col items-center">
                <div>
                  <div class="font-medium text-slate-900">{entry.title}</div>
                  <div class="text-sm text-slate-500 opacity-0 hover:opacity-100 transition-all duration-300">
                    {entry.password}
                  </div>
                </div>

                <button
                  class="text-red-500 text-sm"
                  onClick={async () => {
                    try {
                      const result = await invoke<Vault>("delete_entry", {
                        password: props.password,
                        index: index(),
                      });

                      props.setVault(result);
                    } catch {
                      props.setError("Failed to delete entry");
                    }
                  }}
                >
                  Delete entry
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export default App;
