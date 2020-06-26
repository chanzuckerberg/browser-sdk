function filterQueryString(queryString: string): string {
  return queryString.replace(/=[0-9]\d*/, '=XXXXX'); // Query Parameters
}

function filterPath(path: string): string {
  return path.replace(/\/[0-9]\d*/, '/XXXXX') // Path Parameters
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