function Span(trace, name, labels, parentSpan) {
	this.spanId = trace.getNextSpanId();
	this.kind = Span.SPAN_KIND.UNSPECIFIED;
	// API limits to 2048 chars
	this.name = name.length > 2048 ? name.substring(0, 2048) : name;
	this.startTime = getTimestamp();
	this.labels = labels || {};
	this.parentSpanId = undefined;
	if (parentSpan) {
		parentSpan._spans.push(this);
		this.parentSpanId = parentSpan.spanId;
	}

	this._parentSpan = parentSpan;
	this._spans = [];
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
	for (var l in this.labels) {
		// API limits to 16384 chars. Note that this could also bump up against
		// the total API request size limit.
		if (this.labels[l].length > 16384) {
			this.labels[l] = this.labels[l].substring(0, 16384);
		}
	}
};

/**
 * Removes a span from the trace. And child spans on this trace will be
 * escalated so that their new parent is this span's parent.
 */
Span.prototype.cancel = function cancel() {
	// Remove from trace.
	var idx = this._trace.spans.indexOf(this);
	if (idx !== -1) this._trace.spans.splice(idx, 1);
	// Remove from parent span if present.
	if (this._parentSpan) {
		idx = this._parentSpan._spans.indexOf(this);
		if (idx !== -1) this._parentSpan._spans.splice(idx, 1);
	}
	// Escalate child spans in the graph.
	var thisParentSpanId = this.parentSpanId;
	this._spans.forEach(function (span) {
		if (span.parentSpanId) span.parentSpanId = thisParentSpanId;
	});
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
