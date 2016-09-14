var common = require('@google-cloud/common');
var util = require('util');
var extend = require('extend');
var Trace = require('./trace');
var Span = require('./span');
var createExpressTracer = require('./hooks/express');

var defaultConfig = {
	writeInterval: 5,
	maxBufferSize: 1000
};

function Tracing(options) {
	if (!(this instanceof Tracing)) {
		extend(options, defaultConfig);
		options = common.util.normalizeArguments(this, options);
		return new Tracing(options);
	}

	var config = {
		baseUrl: 'https://cloudtrace.googleapis.com/v1',
		scopes: [
			'https://www.googleapis.com/auth/trace.append',
			'https://www.googleapis.com/auth/trace.readonly'
		],
		packageJson: require('../package.json')
	};

	common.Service.call(this, config, options);

	/**
	 * Closed traces ready to be written.
	 */
	this._buffer = [];

	this._writeQueued = false;

	this.writeInterval = options.writeInterval;
	this.maxBufferSize = options.maxBufferSize;
}

util.inherits(Tracing, common.Service);

/**
 * Gets an existing trace.
 *
 * @param {string} traceId - ID of the trace to retrieve
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {Trace} callback.trace - The full trace.
 */
Tracing.prototype.getTrace = function get(traceId, callback) {
	var _this = this;
	var uri = '/traces/' + traceId;
	this.request({
		uri: uri
	}, function (err, trace) {
		if (err) return callback(err);
		var result = new Trace(_this, trace.traceId);
		var spans = {};
		for (var i = 0; i < trace.spans.length; i++) {
			var spanI = trace.spans[i];
			var spanIR = new Span(
				result,
				spanI.name,
				spanI.labels);
			spanIR.startTime = spanI.startTime;
			spanIR.endTime = spanI.endTime;
			spanIR.kind = spanI.spanKind;
			spans[spanI.spanId] = spanIR;
		}
		result.spans = trace.spans.map(function (span) {
			var spanIR = spans[span.spanId];
			if (span.parentSpanId) {
				spanIR.parentSpanId = span.parentSpanId;
				spans[spanIR.parentSpanId]._spans.push(spanIR);
			}
			return spanIR;
		});
		callback(null, result);
	});
};

/**
 * Starts a trace and a root span. Calling 'end' on the returned root span will
 * also end the trace. Calling 'cancel' will cancel the trace.
 */
Tracing.prototype.startRootSpan = function startRootSpan(name, labels) {
	var trace = this.startTrace();
	var rootSpan = trace.startSpan(name, labels);
	rootSpan.end = trace.end.bind(trace);
	rootSpan.cancel = trace.cancel.bind(trace);
	return rootSpan;
};

/**
 * Starts a trace.
 */
Tracing.prototype.startTrace = function startTrace() {
	return new Trace(this);
};

/**
 * Internal.
 * Queues a completed trace for writing.
 */
Tracing.prototype._queueForWrite = function _queueForWrite(trace) {
	this._buffer.push(trace);
	if (this._buffer.length > this.maxBufferSize) {
		setImmediate(this._write.bind(this));
	} else if (!this._writeQueued) {
		this._writeQueued = true;
		setTimeout(this._write.bind(this), this.writeInterval * 1000).unref();
	}
};

/**
 * Internal.
 * Writes buffer to API.
 */
Tracing.prototype._write = function _write() {
	this._writeQueued = false;
	var traces = this._buffer;
	this._buffer = [];
	var body = JSON.stringify({traces: traces});

	this.request({
		method: 'PATCH',
		uri: '/traces',
		body: body
	}, function (err) {
		if (err) console.log(err);
	});
};

Tracing.prototype.Express = function (config) {
	return createExpressTracer(this, config);
};

Tracing.Trace = Trace;
Tracing.Span = Span;

module.exports = Tracing;
