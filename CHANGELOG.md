1.3.0
============
### Feature
* Use TRACE\_ID and SPAN\_ID in Express hook if provided in request header.

1.2.1
============
### Bug fixes
* Ignore `X-Cloud-Trace-Context` header if it lacks the `o=\d` suffix. (GCP
load balancers can add this header without the suffix.)

1.2.0
============
### Features
* Add `span.cancel` method.

1.1.0
============
### Features
* Add `trace.cancel` method.
* Add `tracing.Express` middleware for tracing Express requests.

1.0.0
============
Initial release.
