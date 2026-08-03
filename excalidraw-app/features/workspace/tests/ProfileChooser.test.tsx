import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ProfileChooser } from "../components/ProfileChooser";

describe("ProfileChooser", () => {
  it("shows every isolated profile and opens only the selected one", () => {
    const onSelect = vi.fn();
    render(
      <ProfileChooser
        profiles={[
          {
            id: "personal",
            name: "Personal",
            createdAt: 1,
            updatedAt: 1,
            protection: { enabled: false },
            appearance: {
              accentColor: "#ffd400",
              accentStyle: "contour",
              accentIntensity: "vivid",
            },
          },
          {
            id: "studio",
            name: "Mi estudio",
            createdAt: 2,
            updatedAt: 2,
            protection: {
              enabled: true,
              version: 1,
              kdf: "PBKDF2",
              hash: "SHA-256",
              iterations: 1,
              salt: "salt",
              verifier: {
                encrypted: true,
                algorithm: "AES-GCM",
                iv: "iv",
                ciphertext: "ciphertext",
                schemaVersion: 1,
              },
            },
            appearance: {
              accentColor: "#27d7ff",
              accentStyle: "racing",
              accentIntensity: "vivid",
            },
          },
        ]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("¿Quién va a crear?")).toBeInTheDocument();
    expect(screen.getByText("● Protegido")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir perfil Mi estudio" }),
    );
    expect(onSelect).toHaveBeenCalledWith("studio");
  });
});
