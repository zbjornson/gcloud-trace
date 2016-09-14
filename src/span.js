function Span(trace, name, labels, parentSpan) {
	this.spanId = trace.getNextSpanId();
	this.kind = Span.SPAN_KIND.UNSPECIFIED;
	this.name = name;
	this.startTime = getTimestamp();
	this.labels = labels || {};
	this._spans = [];
	if (parentSpan) {
		parentSpan._spans.push(this);
		this.parentSpanId = parentSpan.spanId;
	}

	this._trace = trace;
	trace.spans.push(this);
}

Span.SPAN_KIND = {
	UNSPECIFIED: 'SPAN_KIND_UNSPECIFIED',
	RPC_SERVER: 'RPC_SERVER',
	RPC_CLIENT: 'RPC_CLIENT'
};

/**
 * Ends a span and all of its child spans. Idempotent.
 *
 * @param {?object} labels - Labels to add to span. If provided, labels will
 * only be applied to this span, not its children.
 * @param {?boolean} shallow - Do not end child spans.
 */
Span.prototype.end = function end(labels, shallow) {
	if (!shallow) {
		this._spans.forEach(function (span) {
			span.end();
		});
	}
	if (!this.endTime) this.endTime = getTimestamp();
	if (labels) {
		for (var k in labels) {
			this.labels[k] = labels[k];
		}
	}
};

Span.prototype.toObject = function toObject() {
	return {
		spanId: this.spanId,
		kind: this.kind,
		name: this.name,
		startTime: this.startTime,
		endTime: this.endTime,
		labels: this.labels,
		parentSpanId: this.parentSpanId
	};
};

/**
 * Starts a child span on this span.
 *
 * @param {string} name - Name of span.
 * @param {?object} labels - Labels to add to span.
 */
Span.prototype.startSpan = function startSpan(name, labels) {
	var child = new Span(
		this._trace,
		name,
		labels,
		this
	);
	return child;
};

function getTimestamp() {
	return (new Date()).toISOString();
}

module.exports = Span;
