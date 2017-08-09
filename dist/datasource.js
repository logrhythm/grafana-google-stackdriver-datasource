'use strict';

System.register(['lodash', 'moment', './libs/script.js', 'app/core/utils/datemath'], function (_export, _context) {
  "use strict";

  var _, moment, scriptjs, dateMath, _createClass, GoogleStackdriverDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_libsScriptJs) {
      scriptjs = _libsScriptJs.default;
    }, function (_appCoreUtilsDatemath) {
      dateMath = _appCoreUtilsDatemath.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('GoogleStackdriverDatasource', GoogleStackdriverDatasource = function () {
        function GoogleStackdriverDatasource(instanceSettings, $q, templateSrv, timeSrv) {
          _classCallCheck(this, GoogleStackdriverDatasource);

          this.type = instanceSettings.type;
          this.name = instanceSettings.name;
          this.clientId = instanceSettings.jsonData.clientId;
          this.scopes = [
          //'https://www.googleapis.com/auth/cloud-platform',
          //'https://www.googleapis.com/auth/monitoring',
          'https://www.googleapis.com/auth/monitoring.read'].join(' ');
          this.discoveryDocs = ["https://monitoring.googleapis.com/$discovery/rest?version=v3"];
          this.initialized = false;
          this.q = $q;
          this.templateSrv = templateSrv;
          this.timeSrv = timeSrv;
        }

        _createClass(GoogleStackdriverDatasource, [{
          key: 'query',
          value: function query(options) {
            var _this = this;

            return this.initialize().then(function () {
              return Promise.all(options.targets.map(function (target) {
                return _this.performTimeSeriesQuery(target, options.range).then(function (response) {
                  response.timeSeries.forEach(function (series) {
                    series.target = target;
                  });
                  return response;
                });
              })).then(function (responses) {
                var timeSeries = _.flatten(responses.filter(function (response) {
                  return !!response.timeSeries;
                }).map(function (response) {
                  return response.timeSeries;
                }));
                return {
                  data: timeSeries.map(function (series) {
                    var aliasPattern = '{{resource.type}} - {{metric.type}}';
                    if (series.target.alias) {
                      aliasPattern = series.target.alias;
                    }
                    var metricLabel = _this.getMetricLabel(aliasPattern, series);

                    var datapoints = [];
                    var valueKey = series.valueType.toLowerCase() + 'Value';
                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                      for (var _iterator = series.points[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var point = _step.value;

                        datapoints.push([point.value[valueKey], Date.parse(point.interval.endTime).valueOf()]);
                      }
                    } catch (err) {
                      _didIteratorError = true;
                      _iteratorError = err;
                    } finally {
                      try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                          _iterator.return();
                        }
                      } finally {
                        if (_didIteratorError) {
                          throw _iteratorError;
                        }
                      }
                    }

                    return { target: metricLabel, datapoints: datapoints };
                  })
                };
              }, function (err) {
                err = JSON.parse(err.body);
                console.log(err);
                throw err.error;
              });
            });
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            var _this2 = this;

            var range = this.timeSrv.timeRange();
            var labelQuery = query.match(/^label_values\(([^,]+), *([^,]+), *(.*)\)/);
            if (labelQuery) {
              var params = {
                projectId: labelQuery[1],
                filter: labelQuery[3],
                view: 'HEADERS'
              };
              return this.performTimeSeriesQuery(params, range).then(function (response) {
                var valuePicker = _.property(labelQuery[2]);
                return _this2.q.when(response.timeSeries.map(function (d) {
                  return { text: valuePicker(d) };
                }));
              });
            }

            return this.q.when([]);
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            var _this3 = this;

            return this.load().then(function () {
              return gapi.client.init({
                clientId: _this3.clientId,
                scope: _this3.scopes,
                discoveryDocs: _this3.discoveryDocs
              }).then(function () {
                return { status: 'success', message: 'Data source is working', title: 'Success' };
              });
            });
          }
        }, {
          key: 'load',
          value: function load() {
            var deferred = this.q.defer();
            scriptjs('https://apis.google.com/js/api.js', function () {
              gapi.load('client:auth2', function () {
                return deferred.resolve();
              });
            });
            return deferred.promise;
          }
        }, {
          key: 'initialize',
          value: function initialize() {
            var _this4 = this;

            if (this.initialized) {
              return Promise.resolve(gapi.auth2.getAuthInstance().currentUser.get());
            }

            return this.load().then(function () {
              return gapi.client.init({
                clientId: _this4.clientId,
                scope: _this4.scopes,
                discoveryDocs: _this4.discoveryDocs
              }).then(function () {
                var authInstance = gapi.auth2.getAuthInstance();
                if (!authInstance) {
                  throw { message: 'failed to initialize' };
                }
                var isSignedIn = authInstance.isSignedIn.get();
                if (isSignedIn) {
                  _this4.initialized = true;
                  return authInstance.currentUser.get();
                }
                return authInstance.signIn().then(function (user) {
                  _this4.initialized = true;
                  return user;
                });
              }, function (err) {
                console.log(err);
                throw { message: 'failed to initialize' };
              });
            });
          }
        }, {
          key: 'performTimeSeriesQuery',
          value: function performTimeSeriesQuery(target, range) {
            var _this5 = this;

            target = angular.copy(target);
            var params = {};
            params.name = 'projects/' + target.projectId;
            params.filter = target.filter;
            if (target.aggregation) {
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = Object.keys(target.aggregation)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  var key = _step2.value;

                  params['aggregation.' + key] = target.aggregation[key];
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }
            }
            if (target.pageToken) {
              params.pageToken = target.pageToken;
            }
            params['interval.startTime'] = this.convertTime(range.from, false);
            params['interval.endTime'] = this.convertTime(range.to, true);
            return gapi.client.monitoring.projects.timeSeries.list(params).then(function (response) {
              response = JSON.parse(response.body);
              if (!response) {
                return {};
              }
              if (!response.nextPageToken) {
                return response;
              }
              target.pageToken = response.nextPageToken;
              return _this5.performTimeSeriesQuery(target, range).then(function (nextResponse) {
                response = response.timeSeries.concat(nextResponse.timeSeries);
                return response;
              });
            });
          }
        }, {
          key: 'getMetricLabel',
          value: function getMetricLabel(aliasPattern, series) {
            var aliasRegex = /\{\{(.+?)\}\}/g;
            var aliasData = {
              metric: series.metric,
              resource: series.resource
            };
            var label = aliasPattern.replace(aliasRegex, function (match, g1) {
              var matchedValue = _.property(g1)(aliasData);
              if (matchedValue) {
                return matchedValue;
              }
              return g1;
            });
            return label;
          }
        }, {
          key: 'convertTime',
          value: function convertTime(date, roundUp) {
            if (_.isString(date)) {
              date = dateMath.parse(date, roundUp);
            }
            return date.toISOString();
          }
        }]);

        return GoogleStackdriverDatasource;
      }());

      _export('GoogleStackdriverDatasource', GoogleStackdriverDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
