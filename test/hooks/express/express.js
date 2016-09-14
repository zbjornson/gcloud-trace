var Tracing = require('../../..');
var tracing = Tracing({projectId: process.env.GCLOUD_PROJECT});
var assert = require('assert');
var express = require('express');
var request = require('request');

// Keep node alive while the tests run.
setTimeout(function () {}, tracing.writeInterval * 1000 * 3);

(function simple() {
	var app = express();
	app.use(tracing.Express({}));
	app.get('/', function (req, res) {
		assert.ok(req.trace);
		setTimeout(function () {
			res.send({message: 'hey!'});
		}, 150);
	});
	app.get('/foo/bar', function (req, res) {
		setTimeout(function () {
			var childSpan = req.trace.startSpan('child span');
			setTimeout(function () {
				childSpan.end();
				res.send({message: 'a deeper url'});
			}, 250);
		}, 50);
	});
	var server = app.listen(8080, function () {
		request('http://localhost:8080/', function (err, res, body) {
			assert.ifError(err);
			request('http://localhost:8080/foo/bar', function (err, res, body) {
				assert.ifError(err);
				server.close();
			});
		});
	});
})();

(function rateLimited() {
	var app = express();
	app.use(tracing.Express({
		maxRPS: 1
	}));
	app.get('/', function (req, res) {
		assert.ok(req.trace);
		setTimeout(function () {
			res.send({message: 'hey!'});
		}, 150);
	});
	var server = app.listen(8081, function () {
		for (var i = 0; i < 10; i++) {
			request('http://localhost:8081/foo/bar', function (err, res, body) {
				assert.ifError(err);
			});
		}
		setTimeout(function () { server.close(); }, 500);
	});
})();

(function ctHeader() {
	var app = express();
	app.use(tracing.Express({
		maxRPS: 0
	}));
	app.get('/', function (req, res) {
		assert.ok(req.trace);
		setTimeout(function () {
			res.send({message: 'hey!'});
		}, 150);
	});
	var server = app.listen(8082, function () {
		request({
			url: 'http://localhost:8082/foo/bar?shouldbelogged',
			headers: {
				'X-Cloud-Trace-Context': '105445aa7843bc8bf206b120001000/0;o=1'
			}
		}, function (err, res, body) {
			assert.ifError(err);
			server.close();
		});
	});
})();
