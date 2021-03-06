var XCTC_HEADER = 'x-cloud-trace-context';
var TRACE_ID_REGEX = /^([0-9a-f]{32})/;
var SPAN_ID_REGEX = /\/(\d+)/;
var O_SUFFIX_REGEX = /o=\d$/;
var O1_SUFFIX_REGEX = /o=1$/;

module.exports = function createExpressTracer(tracing, config) {
	var shouldTrace = (function () {
		if (config && typeof config.maxRPS === 'number') {
			var maxRPS = config.maxRPS;
			var requests = 0;
			setInterval(function () {
				requests = 0;
			}, 1000).unref();
			return function shouldTrace(req) {
				var xctc = req.get(XCTC_HEADER);
				if (xctc && O_SUFFIX_REGEX.test(xctc)) {
					return O1_SUFFIX_REGEX.test(xctc);
				}
				return requests++ < maxRPS;
			};
		} else {
			return function shouldTrace(req) {
				var xctc = req.get(XCTC_HEADER);
				if (xctc) return O1_SUFFIX_REGEX.test(xctc);
				return true;
			};
		}
	})();

	var hostname = require("os").hostname();

	/**
	 * Express middleware. Adds a root span to the request, labeled with basic
	 * information about the request. Trace subspans using:
	 *
	 * ```
	 * var span = req.trace.startSpan('name'[, labels]);
	 * ...
	 * span.end();
	 * ```
	 */
	return function traceExpress(req, res, next) {
		var method = req.method;
		var url = (req.baseUrl || '') + (req.url || '-');
		var labels = {
			'trace.cloud.google.com/http/method': method,
			'trace.cloud.google.com/http/url': url,
			'trace.cloud.google.com/http/host': hostname
		};

		var trace = tracing.startTrace();
		var xctc = req.get(XCTC_HEADER);
		if (xctc) {
			var match;
			match = xctc.match(TRACE_ID_REGEX);
			if (match && match.length === 2) trace.traceId = match[1];
			match = xctc.match(SPAN_ID_REGEX);
			if (match && match.length === 2) {
				var spanId = parseInt(match[1], 10);
				if (Number.isSafeInteger(spanId)) trace._spanIdInc = spanId;
			}
		}
		req.trace = trace.startSpan(url, labels);

		function endTrace() {
			// This is checked at the end so that consumers can still use the
			// req.trace property fully.
			if (!shouldTrace(req)) return;

			var statusCode = res.statusCode;
			if (statusCode !== undefined) statusCode = statusCode.toString();
			var contentLength = res.get('content-length');
			if (contentLength !== undefined) contentLength = contentLength.toString();

			var labels = {
				'trace.cloud.google.com/http/status_code': statusCode,
				'trace.cloud.google.com/http/response/size': contentLength
			};
			req.trace.end(labels);
			trace.end();
		}

		res.once('finish', endTrace);
		res.once('close', endTrace);

		next();
	};
};
