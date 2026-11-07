import { app, BrowserWindow, protocol, net, session, Menu } from "electron";
import { join, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const isLocal = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "app:" && parsed.hostname === "robo-chef";
  } catch {
    return false;
  }
};

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 700,
    title: "Robo Chef",
    icon: join(app.getAppPath(), "assets/icon.png"),
    backgroundColor: "#242629",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isLocal(url)) event.preventDefault();
  });
  window.loadURL("app://robo-chef/index.html");
  return window;
}

app.whenReady().then(() => {
  const root = join(app.getAppPath(), "dist");
  protocol.handle("app", async (request) => {
    if (!isLocal(request.url))
      return new Response("Not found", { status: 404 });
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const file = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    const path = relative(root, file);
    if (path.startsWith("..") || isAbsolute(path))
      return new Response("Forbidden", { status: 403 });
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
    );
    return new Response(response.body, { status: response.status, headers });
  });
  session.defaultSession.setPermissionCheckHandler(
    (_contents, permission, origin, details) =>
      isLocal(origin) &&
      permission === "media" &&
      details.mediaType === "video",
  );
  session.defaultSession.setPermissionRequestHandler(
    (_contents, permission, callback, details) => {
      callback(
        isLocal(details.requestingUrl) &&
          permission === "media" &&
          details.mediaTypes?.length > 0 &&
          details.mediaTypes.every((type) => type === "video"),
      );
    },
  );
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
