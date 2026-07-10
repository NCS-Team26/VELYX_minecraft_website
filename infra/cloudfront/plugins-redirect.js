// CloudFront Function (viewer-request) — legacy Economy URL redirect.
//
// Permanently redirects the old Economy path /plugins(.html) to /economy.html
// with an HTTP 308, preserving the query string. Every other URI is returned
// unchanged so the function is a no-op for the rest of the site.
//
// Notes:
// - Only /plugins and /plugins.html match, so there is no redirect loop
//   (/economy.html is never rewritten back to /plugins.html).
// - The URL fragment (#hash) is not available to a viewer-request function;
//   hash preservation is handled by the plugins.html client fallback document.
// - Runtime: cloudfront-js-2.0.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/plugins" || uri === "/plugins.html") {
    var query = request.querystring;
    var parts = [];

    for (var key in query) {
      if (!Object.prototype.hasOwnProperty.call(query, key)) {
        continue;
      }

      var item = query[key];

      if (item.multiValue && item.multiValue.length) {
        for (var index = 0; index < item.multiValue.length; index += 1) {
          parts.push(
            encodeURIComponent(key) + "=" + encodeURIComponent(item.multiValue[index].value)
          );
        }
      } else if (item.value) {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(item.value));
      } else {
        parts.push(encodeURIComponent(key));
      }
    }

    var location = "/economy.html";
    if (parts.length) {
      location += "?" + parts.join("&");
    }

    return {
      statusCode: 308,
      statusDescription: "Permanent Redirect",
      headers: {
        location: { value: location },
        "cache-control": { value: "public, max-age=3600" },
      },
    };
  }

  return request;
}
