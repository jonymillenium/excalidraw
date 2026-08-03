# Workspace security model

## What is protected

When project protection is enabled, the following records are encrypted before they enter IndexedDB:

- project description;
- every canvas scene and persistable app state;
- saved views contained by each canvas payload;
- every binary/image file as an independent record.

The dashboard deliberately leaves project ID, name, timestamps, canvas count, order, and protection status visible. This supports a useful locked dashboard without deriving keys for every card. A future high-privacy mode may hide the name as well.

## Cryptographic construction

- Key derivation: PBKDF2 with SHA-256.
- Iterations: 600,000.
- Salt: 16 random bytes per protection setup or password change.
- Encryption: AES-GCM with a 256-bit key.
- IV: 12 fresh random bytes for every encryption operation.
- Key extractability: false.
- Additional authenticated data: `schemaVersion`, `projectId`, and record type/ID.

The verifier is an encrypted payload containing its project ID and schema version. Wrong passwords, corrupted ciphertext, and mismatched AAD all produce the same UI error: `La contraseña es incorrecta o los datos están dañados.`

## Password and key lifecycle

Passwords are only held in component/form variables long enough to derive a key. They are never written to IndexedDB, localStorage, sessionStorage, URLs, exports, analytics, or logs. The derived non-exportable `CryptoKey` stays in an in-memory `Map` owned by `WorkspaceApp`.

`Bloquear ahora` flushes pending edits, removes the key from the map, closes the active project, and returns to the dashboard. Reloading or closing the tab destroys the JavaScript realm and the key with it.

There is no password recovery. The UI warns about this before creating protection.

## Password changes

Changing a password verifies the current password, decrypts every project record in memory, creates a new salt and key, generates fresh IVs, and writes the fully re-encrypted project in a single IndexedDB transaction. Removing a password follows the same read/validate/transaction pattern and only clears protection parameters as part of the successful write.

## Backups

Protected backups contain the encrypted envelopes already stored locally; exporting does not create a plaintext copy. The backup retains its protection parameters and password. Unprotected backups are readable JSON by design.

## Threat boundaries

This MVP protects data at rest from casual browser-storage inspection and from someone opening a locked project without its password. It does not protect against:

- malicious browser extensions or scripts executing in the same origin while the project is unlocked;
- a compromised operating system;
- screenshots, clipboard capture, or memory inspection;
- weak user-chosen passwords;
- denial of service through deletion of browser storage.

Use HTTPS outside localhost. Keep exported backups in a location appropriate to their sensitivity.
