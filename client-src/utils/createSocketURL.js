/**
 * @param {{ protocol?: string, auth?: string, hostname?: string, port?: string, pathname?: string, search?: string, hash?: string, slashes?: boolean }} objURL
 * @returns {string}
 */
function format(objURL) {
  let protocol = objURL.protocol || "";

  if (protocol && protocol.substr(-1) !== ":") {
    protocol += ":";
  }

  let auth = objURL.auth || "";

  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ":");
    auth += "@";
  }

  let host = "";

  if (objURL.hostname) {
    host =
      auth +
      (objURL.hostname.indexOf(":") === -1
        ? objURL.hostname
        : `[${objURL.hostname}]`);

    if (objURL.port) {
      host += `:${objURL.port}`;
    }
  }

  let pathname = objURL.pathname || "";

  if (objURL.slashes) {
    host = `//${host || ""}`;

    if (pathname && pathname.charAt(0) !== "/") {
      pathname = `/${pathname}`;
    }
  } else if (!host) {
    host = "";
  }

  let search = objURL.search || "";

  if (search && search.charAt(0) !== "?") {
    search = `?${search}`;
  }

  let hash = objURL.hash || "";

  if (hash && hash.charAt(0) !== "#") {
    hash = `#${hash}`;
  }

  pathname = pathname.replace(
    /[?#]/g,
    /**
     * @param {string} match
     * @returns {string}
     */
    (match) => encodeURIComponent(match)
  );
  search = search.replace("#", "%23");

  return `${protocol}${host}${pathname}${search}${hash}`;
}

/**
 * @param {URL & { fromCurrentScript?: boolean }} parsedURL
 * @returns {string}
 */
function createSocketURL(parsedURL) {
  let { hostname } = parsedURL;
  let socketURLPort = parsedURL.port;

  // Node.js module parses it as `::`
  // `new URL(urlString, [baseURLString])` parses it as '[::]'
  const isInAddrAny =
    hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";

  // why do we need this check?
  // hostname n/a for file protocol (example, when using electron, ionic)
  // see: https://github.com/webpack/webpack-dev-server/pull/384
  if (
    isInAddrAny &&
    self.location.hostname &&
    self.location.protocol.indexOf("http") === 0
  ) {
    hostname = self.location.hostname;
    // If we are using the location.hostname for the hostname, we should use the port from
    // the location as well
    socketURLPort = self.location.port;
  }

  let socketURLProtocol = parsedURL.protocol || self.location.protocol;

  // When https is used in the app, secure web sockets are always necessary because the browser doesn't accept non-secure web sockets.
  if (
    socketURLProtocol === "auto:" ||
    (hostname && isInAddrAny && self.location.protocol === "https:")
  ) {
    socketURLProtocol = self.location.protocol;
  }

  socketURLProtocol = socketURLProtocol.replace(
    /^(?:http|.+-extension|file)/i,
    "ws"
  );

  let socketURLAuth = "";

  // `new URL(urlString, [baseURLstring])` doesn't have `auth` property
  // Parse authentication credentials in case we need them
  if (parsedURL.username) {
    socketURLAuth = parsedURL.username;

    // Since HTTP basic authentication does not allow empty username,
    // we only include password if the username is not empty.
    if (parsedURL.password) {
      // Result: <username>:<password>
      socketURLAuth = socketURLAuth.concat(":", parsedURL.password);
    }
  }

  // In case the host is a raw IPv6 address, it can be enclosed in
  // the brackets as the brackets are needed in the final URL string.
  // Need to remove those as url.format blindly adds its own set of brackets
  // if the host string contains colons. That would lead to non-working
  // double brackets (e.g. [[::]]) host
  //
  // All of these web socket url params are optionally passed in through resourceQuery,
  // so we need to fall back to the default if they are not provided
  const socketURLHostname = (
    hostname ||
    self.location.hostname ||
    "localhost"
  ).replace(/^\[(.*)\]$/, "$1");

  if (!socketURLPort || socketURLPort === "0") {
    socketURLPort = self.location.port;
  }

  // If path is provided it'll be passed in via the resourceQuery as a
  // query param so it has to be parsed out of the querystring in order for the
  // client to open the socket to the correct location.
  let socketURLPathname = "/ws";

  if (parsedURL.pathname && !parsedURL.fromCurrentScript) {
    socketURLPathname = parsedURL.pathname;
  }

  return format({
    protocol: socketURLProtocol,
    auth: socketURLAuth,
    hostname: socketURLHostname,
    port: socketURLPort,
    pathname: socketURLPathname,
    slashes: true,
  });
}

export default createSocketURL;
