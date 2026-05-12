import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  getPortableHermesEnv,
  resolveAppBaseDir,
} from "../src/main/portable-paths";

function winPath(...parts: string[]): string {
  return parts.join("\\");
}

describe("Round8A portable data path resolution", () => {
  it("uses project data/ in dev mode even when ELECTRON_RENDERER_URL is present", () => {
    const projectRoot = join("tmp", "hermes-desktop");
    const result = resolveAppBaseDir({
      electronRendererUrl: "http://localhost:5173",
      dirname: join(projectRoot, "out", "main"),
      resourcesPath: winPath("E:", "HermesUSB", "resources"),
      cwd: projectRoot,
      hasPackageJson: (dir) => dir === projectRoot,
    });

    expect(result).toBe(join(projectRoot, "data"));
  });

  it("resolves Windows packaged data directory next to app on E: drive", () => {
    const result = resolveAppBaseDir({
      dirname: winPath("E:", "HermesUSB", "resources", "app.asar", "out", "main"),
      resourcesPath: winPath("E:", "HermesUSB", "resources"),
      cwd: winPath("E:", "HermesUSB"),
      hasPackageJson: () => false,
    });

    expect(result).toBe(winPath("E:", "HermesUSB", "data"));
  });

  it("resolves Windows packaged data directory next to app after drive-letter move", () => {
    const result = resolveAppBaseDir({
      dirname: winPath("F:", "HermesUSB", "resources", "app.asar", "out", "main"),
      resourcesPath: winPath("F:", "HermesUSB", "resources"),
      cwd: winPath("F:", "HermesUSB"),
      hasPackageJson: () => false,
    });

    expect(result).toBe(winPath("F:", "HermesUSB", "data"));
  });

  it("gives HERMES_DESKTOP_DATA_DIR highest priority", () => {
    const override = winPath("X:", "CustomHermesData");
    const result = resolveAppBaseDir({
      envDataDir: override,
      dirname: winPath("E:", "HermesUSB", "resources", "app.asar", "out", "main"),
      resourcesPath: winPath("E:", "HermesUSB", "resources"),
      cwd: winPath("E:", "HermesUSB"),
      hasPackageJson: () => false,
    });

    expect(result).toBe(override);
  });

  it("resolves macOS packaged data directory next to .app bundle", () => {
    const result = resolveAppBaseDir({
      dirname: "/Applications/Hermes Agent.app/Contents/Resources/app.asar/out/main",
      resourcesPath: "/Applications/Hermes Agent.app/Contents/Resources",
      cwd: "/Applications",
      hasPackageJson: () => false,
    });

    expect(result).toBe("/Applications/Hermes Agent.app/data");
  });
});

describe("Round8A portable Hermes environment", () => {
  it("forces portable Hermes env values from HERMES_DESKTOP_DATA_DIR", () => {
    const previousDataDir = process.env.HERMES_DESKTOP_DATA_DIR;
    const previousHermesHome = process.env.HERMES_HOME;
    const previousHermesProfile = process.env.HERMES_PROFILE;

    try {
      process.env.HERMES_DESKTOP_DATA_DIR = join("tmp", "HermesUSB", "data");
      process.env.HERMES_HOME = join("tmp", "host-home", ".hermes");
      process.env.HERMES_PROFILE = "host-profile";

      const env = getPortableHermesEnv({ HERMES_PROFILE: "caller-profile" });

      expect(env.HERMES_HOME).toBe(join("tmp", "HermesUSB", "data", "hermes"));
      expect(env.HERMES_PROFILE).toBe("portable");
      expect(env.HERMES_WORKSPACE).toBe(join("tmp", "HermesUSB", "data", "workspace"));
    } finally {
      if (previousDataDir === undefined) delete process.env.HERMES_DESKTOP_DATA_DIR;
      else process.env.HERMES_DESKTOP_DATA_DIR = previousDataDir;
      if (previousHermesHome === undefined) delete process.env.HERMES_HOME;
      else process.env.HERMES_HOME = previousHermesHome;
      if (previousHermesProfile === undefined) delete process.env.HERMES_PROFILE;
      else process.env.HERMES_PROFILE = previousHermesProfile;
    }
  });
});
