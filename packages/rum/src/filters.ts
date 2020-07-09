function filterQueryString(queryString: string): string {
  // Query Parameters
  // Match Alphanumeric & numeric strings, ignore just letters
  return queryString.replace(/=(?![\/a-z_-])[a-zA-Z_0-9]*/g, '=XXXXX');
}

function filterPath(path: string): string {
  // Path Parameters
  // Match Alphanumeric & numeric strings, ignore just letters
  return path.replace(/\/(?![\/a-z_-])[a-zA-Z_0-9]*/g, '/XXXXX');
}

export function filterUrl(url: string): string {
  url = filterPath(url);
  url = filterQueryString(url);
  return url;
}

export function filterViewLocation(location: Location): Location {
  location.href = filterUrl(location.href);
  location.pathname = filterPath(location.pathname);
  location.search = filterQueryString(location.search);

  return location;
}