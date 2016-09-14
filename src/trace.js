var Span = require('./span');
var crypto = require('crypto');

function Trace(agent, traceId) {
	this._agent = agent;
	this._spanIdInc = 1;
	this.projectId = agent.projectId;
	this.traceId = traceId || hex(32);
	this.spans = [];
}

Trace.prototype.getNextSpanId = function () {
	return (this._spanIdInc++).toString();
};

/**
 * Starts a root-level span on this trace.
 */
Trace.prototype.startSpan = function startSpan(name, labels) {
	var span = new Span(
		this,
		name,
		labels
	);
	return span;
};

/**
 * Ends this trace and all of its spans, then queues it for writing.
 */
Trace.prototype.end = function end() {
	this.spans.forEach(function (span) {
		// Spans created with startRootSpan have an augmented 'end' method.
		// Need to explicitly call the prototype method to avoid infinite
		// recursion.
		Span.prototype.end.call(span, null, true);
	});
	this._agent._queueForWrite(this.toObject());
};

/**
 * Formats this Trace for writing (i.e. removes private members).
 */
Trace.prototype.toObject = function toObject() {
	return {
		projectId: this.projectId,
		traceId: this.traceId,
		spans: this.spans.map(function (s) { return s.toObject(); })
	};
};

/**
 * Generates a random hex string of the provided length.
 */
function hex(n) {
	return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

module.exports = Trace;
