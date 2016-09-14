var Tracing = require('..');
var tracing = Tracing({projectId: process.env.GCLOUD_PROJECT});
var assert = require('assert');

// Keep node alive while the tests run.
setTimeout(function () {}, tracing.writeInterval * 1000 * 3);

(function simple() {
	var span0 = tracing.startRootSpan('root span');
	assert.ok(span0.startTime);
	assert.equal(span0.name, 'root span');
	assert.deepEqual(span0.labels, {});

	setTimeout(function () {
		var span1 = span0.startSpan('child span 1', {key: 'val'});
		assert.equal(span1.parentSpanId, span0.spanId);
		assert.ok(span1.startTime);
		assert.equal(span1.name, 'child span 1');
		assert.deepEqual(span1.labels, {key: 'val'});

		setTimeout(function () {
			span1.end();
			assert.ok(span1.endTime);
			var span2 = span0.startSpan('child span 2');

			setTimeout(function () {
				span0.end();
				assert.ok(span2.endTime);
				assert.ok(span0.endTime);

			}, 50);
		}, 50);
	}, 50);
})();

(function simpleWithKind() {
	var span0 = tracing.startRootSpan('root span with kinds');

	setTimeout(function () {
		var span1 = span0.startSpan('RPC client span');
		span1.kind = Tracing.Span.SPAN_KIND.RPC_CLIENT;

		var span11 = span0.startSpan('RPC client span 2');
		span11.kind = Tracing.Span.SPAN_KIND.RPC_CLIENT;

		setTimeout(function () {
			var span2 = span1.startSpan('RPC server span');
			span2.kind = Tracing.Span.SPAN_KIND.RPC_SERVER;

			setTimeout(function () {
				span0.end();
			}, 50);
		}, 50);
	}, 50);
})();

(function specialLabels() {
	var labels = {
		'trace.cloud.google.com/http/status_code': '200',
		'trace.cloud.google.com/http/method': 'POST',
		'trace.cloud.google.com/http/url': 'http://test.com/path/',
		'trace.cloud.google.com/http/host': 'hostname',
		'trace.cloud.google.com/http/response/size': '123456',
		'trace.cloud.google.com/gae/app/module': 'service name',
		'trace.cloud.google.com/gae/request_log_id': 'sl5ei9fdplskw'
	};
	var span0 = tracing.startRootSpan('root span with labels', labels);

	setTimeout(function () {
		span0.end();
	}, 50);
})();

(function patchExisting() {
	var span0 = tracing.startRootSpan('original existing span');

	setTimeout(function () {
		span0.end();

		setTimeout(function () {
			tracing.getTrace(span0._trace.traceId, function (err, trace) {
				assert.ifError(err);
				assert(trace instanceof Tracing.Trace);
				assert(trace.spans[0] instanceof Tracing.Span);
				trace.spans[0].name = 'patched existing span';
				trace.end();
			});
		}, tracing.writeInterval * 1000 * 1.5);

	}, 50);
})();
