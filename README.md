#### Preface

This is a simple, unofficial library for creating Stackdriver traces. Google
has an [alpha library](https://github.com/GoogleCloudPlatform/cloud-trace-nodejs)
that instruments a variety of common modules, which you may prefer to use
instead.

## Authentication
If running on Google Cloud Platform, authentication can happen automatically
if you have the `https://www.googleapis.com/auth/trace.append` or `https://www.googleapis.com/auth/cloud-platform`
(a.k.a. `cloud-platform`) OAuth scope enabled on the resource where you're
running this library. Otherwise you will need to provide credentials:

```js
var projectId = process.env.GCLOUD_PROJECT; // e.g. 'grape-spaceship-123'

var tracing = require('gcloud-trace')({
  projectId: projectId,

  // The path to your key file:
  keyFilename: '/path/to/keyfile.json'

  // Or the contents of the key file:
  credentials: require('./path/to/keyfile.json')
});
```

## Example

```js
var config = {
	projectId: 'my-project'
};
var tracing = require('gcloud-trace')(config);

function myfn(req, res, next) {
	var span0 = tracing.startRootSpan('name'); // creates a trace and root-level span
	// Do some work

	// Optionally create nested spans with or without labels
	var span1 = span0.startSpan('child span 1', {key1: 'value 1'});
	// Do some work

	var span2 = span1.startSpan('child span 1-1');
	// Do some other work

	span2.end(); // optional; if omitted will end when span1 or trace/span0 ends
	span1.end(); // optional; if omitted will end when trace/span0 ends
	span0.end(); // required
}
```

## API

### Class: `Tracing`

#### require('gcloud-trace')(config)
* `config.writeInterval <Number>` Maximum write interval in seconds.
* `config.maxBufferSize <Number>` Maximum buffer size before a write is forced.
* Return: `tracing` instance.

#### tracing.startRootSpan(name[, labels])
* `name <String>` Name for the span.
* `labels <Object>` Optional labels to apply to the span.
* Return: `<Span>`

This is what you will typically use to create traces.

Creates a trace with a root span with the provided name and optional labels.
The `end` method on the returned span is augmented to also end the trace.
(Calling `end` on a span created with `trace.startSpan()` does not end the
trace.) The returned span also has a `cancel` method (see
[`Trace.cancel`](#tracecancel)).

Note that this root-level span's name is used as the URI in the Stackdriver
Trace web interface trace list.

#### tracing.startTrace()
* Return: `<Trace>`

Creates an empty trace.

#### tracing.getTrace(traceId, callback)
* `traceId <String>` Trace ID to retrieve.
* `callback <Function>` The callback function.
  * `callback.err <?Error>` An error returned while making this request.
  * `callback.trace <Trace>` The trace.

The Stackdriver Trace API allows patching of traces at any time. You can thus
use this to retrieve an existing trace and modify existing or add new spans to
it. For example, you could send a traceId to an RPC server and continue tracing
on the other server.

### Class: `Trace`

#### trace.startSpan(name[, labels])
* `name <String>` Name for the span.
* `labels <Object>` Optional labels to apply to the span.
* Return: `<Span>`

Starts a new root-level span on this trace.

#### trace.end()

Ends all of the trace's spans and queues it for writing.

#### trace.cancel()
*Added in 1.1.0*

Cancels the trace. All methods remain intact on the trace and its spans, but
calling `end` will not send the trace to the server.

### Class: `Span`

#### span.end([labels])
* `labels <Object>` Optional key-value label pairs to apply to the span.

Ends this span.

#### span.startSpan(name[, labels])
* `name <String>` Name for the span.
* `labels <Object>` Optional labels to apply to the span.
* Return: `<Span>`

Starts a new child span on this span.

#### Enum Span.SPAN_KIND
* `UNSPECIFIED`
* `RPC_SERVER`
* `RPC_CLIENT`

These don't seem to have an effect on display in the GCP console, but you can
set the span kind to these values if you wish:
`span.kind = Span.SPAN_KIND.RPC_SERVER`. See [docs](https://cloud.google.com/trace/api/reference/rest/v1/projects.traces#SpanKind).

## Hooks

### Express
*Added in 1.1.0*

```js
var tracing = require('gcloud-trace')({projectId: 'my-project'});
var app = express();
app.use(tracing.Express());
app.use('/path', function (req, res) {
  // Use req.trace.startSpan to trace operations within a request:
  var span = req.trace.startSpan('doing work');
  // do work...
  span.end(); // optional; will get closed when the request ends.
});
```

The `tracing.Express` middleware traces requests end-to-end with a root span,
which is automatically labeled with the method, URL, status code and response
size. That span is exposed as `req.trace` if you want to add child spans in
your request handlers or other middleware.

Use the `config` to set rate limiting on tracing (default is unlimited):

```js
app.use(tracing.Express({
  maxRPS: 100 // trace up to 100 requests per second
}));
```

If you want to skip tracing for a particular route or under particular cases,
call `req.trace.cancel()`.

The `o=TRACE_TRUE` suffix of the `X-Cloud-Trace-Context` header can be used to
force a request to be traced or not traced (see [docs](https://cloud.google.com/trace/docs/faq#how_do_i_force_a_request_to_be_traced)).
The `TRACE_ID` and `SPAN_ID` fields are ignored; you can use any value (or no
value) for those; e.g. `X-Cloud-Trace-Context: o=1` would work. (Author's note:
I'm not sure what the use case is for those aside from later looking up that
specific request's trace; they seem like a hassle otherwise.)

## Tips

### Labels
Google uses several special labels present on root spans to display traces
nicely. Some of them are documented [here](https://cloud.google.com/trace/docs/viewing-details#view_the_timeline);
the rest listed below are based on observations:

* `"trace.cloud.google.com/http/status_code": "200"`
  * Displayed on the trace details page; used for filtering on trace list page.
* `"trace.cloud.google.com/http/method": "POST"`
  * Displayed on the trace list and details pages.
* `"trace.cloud.google.com/http/url": "http://test.com/path/"` (or relative URL)
  * Displayed at the top of the trace details pages.
* `"trace.cloud.google.com/http/host": "hostname"`
  * This is listed in the above-linked docs, but doesn't seem to be handled
  specially. (Only shows up in the sidebar.)
* `"trace.cloud.google.com/http/response/size": "123456"`
  * This is listed in the above-linked docs, but doesn't seem to be handled
  specially. (Only shows up in the sidebar.)
* `"trace.cloud.google.com/gae/app/module": "service name"`
  * Displayed as the "Service" in Trace Details.
* `"trace.cloud.google.com/gae/request_log_id": "12ab8cd8fh9ac"`
  * Used to connect the "show logs" button in the trace viewer to the
  Stackdriver logging interface/viewer. This seems to be limited to querying
  appengine logs based on the log's `request_id`.

Also note that the root-level span's name is used as the URI in the trace list.

### Effects on node.js process

Write are batched and dispatched at the `writeInterval` interval. The batching
timer is weakly referenced; it will not keep the node process alive after a
shutdown has started, but consequently writes may be lost on shutdown.
