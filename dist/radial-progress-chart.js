(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RadialProgressChart = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var d3;

// RadialProgressChart object
function RadialProgressChart(query, options) {

  // verify d3 is loaded
  d3 = (typeof window !== 'undefined' && window.d3) ? window.d3 : typeof require !== 'undefined' ? require("d3") : undefined;
  if(!d3) throw new Error('d3 object is missing. D3.js library has to be loaded before.');

  var self = this;
  self.options = RadialProgressChart.normalizeOptions(options);

  // internal  variables
  var series = self.options.series
    , width = 15 + ((self.options.diameter / 2) + (self.options.stroke.width * self.options.series.length) + (self.options.stroke.gap * self.options.series.length - 1)) * 2
    , height = width
    , dim = "0 0 " + height + " " + width
    , τ = 2 * Math.PI
    , inner = []
    , outer = [];

  function innerRadius(item) {
    var radius = inner[item.index];
    if (radius) return radius;

    // first ring based on diameter and the rest based on the previous outer radius plus gap
    radius = item.index === 0 ? self.options.diameter / 2 : outer[item.index - 1] + self.options.stroke.gap;
    inner[item.index] = radius;
    return radius;
  }

  function outerRadius(item) {
    var radius = outer[item.index];
    if (radius) return radius;

    // based on the previous inner radius + stroke width
    radius = inner[item.index] + self.options.stroke.width;
    outer[item.index] = radius;
    return radius;
  }

  self.progress = d3.svg.arc()
    .startAngle(0)
    .endAngle(function (item) {
      return item.percentage / 100 * τ;
    })
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(function (d) {
      // Workaround for d3 bug https://github.com/mbostock/d3/issues/2249
      // Reduce corner radius when corners are close each other
      var m = d.percentage >= 90 ? (100 - d.percentage) * 0.1 : 1;
      return (self.options.stroke.width / 2) * m;
    });

  var background = d3.svg.arc()
    .startAngle(0)
    .endAngle(τ)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // create svg
  self.svg = d3.select(query).append("svg")
    .attr("preserveAspectRatio","xMinYMin meet")
    .attr("viewBox", dim)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  // add gradients defs
  var defs = self.svg.append("svg:defs");
  series.forEach(function (item) {
    if (item.color.linearGradient || item.color.radialGradient) {
      var gradient = RadialProgressChart.Gradient.toSVGElement('gradient' + item.index, item.color);
      defs.node().appendChild(gradient);
    }
  });

  // add shadows defs
  defs = self.svg.append("svg:defs");
  var dropshadowId = "dropshadow-" + Math.random();
  var filter = defs.append("filter").attr("id", dropshadowId);
  if(self.options.shadow.width > 0) {
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", self.options.shadow.width)
      .attr("result", "blur");

    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");
  }

  var feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // add inner text
  if (self.options.center) {
    self.svg.append("text")
      .attr('class', 'rbc-center-text')
      .attr("text-anchor", "middle")
      .attr('x', self.options.center.x + 'px')
      .attr('y', self.options.center.y + 'px')
      .selectAll('tspan')
      .data(self.options.center.content).enter()
      .append('tspan')
      .attr("dominant-baseline", function () {

        // Single lines can easily centered in the middle using dominant-baseline, multiline need to use y
        if (self.options.center.content.length === 1) {
          return 'central';
        }
      })
      .attr('class', function (d, i) {
        return 'rbc-center-text-line' + i;
      })
      .attr('x', 0)
      .attr('dy', function (d, i) {
        if (i > 0) {
          return '1.1em';
        }
      })
      .each(function (d) {
        if (typeof d === 'function') {
          this.callback = d;
        }
      })
      .text(function (d) {
        if (typeof d === 'string') {
          return d;
        }

        return '';
      });
  }

  // add ring structure
  self.field = self.svg.selectAll("g")
    .data(series)
    .enter().append("g");

  var progressRing = self.field.append("path")
    .attr("class", "progress")
    .style("fill", function (item) {
      if (item.color.solid) {
        return item.color.solid;
      }

      if (item.color.linearGradient || item.color.radialGradient) {
        return "url(#gradient" + item.index + ')';
      }
    });

  if (self.options.shadow.width > 0) {
    progressRing.attr("filter", "url(#" + dropshadowId +")");
  }

  self.field.append("path").attr("class", "bg")
    .style("fill", function (item) {
      return item.color.background;
    })
    .style("opacity", 0.2)
    .attr("d", background);

  self.field.append("text")
    .classed('rbc-label rbc-label-start', true)
    .attr("dominant-baseline", "central")
    .attr("x", "10")
    .attr("y", function (item) {
      return -(
        self.options.diameter / 2 +
        item.index * (self.options.stroke.gap + self.options.stroke.width) +
        self.options.stroke.width / 2
        );
    })
    .text(function (item) {
      return item.labelStart;
    });

  self.update();
}

/**
 * Update data to be visualized in the chart.
 *
 * @param {Object|Array} data Optional data you'd like to set for the chart before it will update. If not specified the update method will use the data that is already configured with the chart.
 * @example update([70, 10, 45])
 * @example update({series: [{value: 70}, 10, 45]})
 *
 */
RadialProgressChart.prototype.update = function (data) {
  var self = this;

  // parse new data
  if (data) {
    if (typeof data === 'number') {
      data = [data];
    }

    var series;

    if (Array.isArray(data)) {
      series = data;
    } else if (typeof data === 'object') {
      series = data.series || [];
    }

    for (var i = 0; i < series.length; i++) {
      this.options.series[i].previousValue = this.options.series[i].value;

      var item = series[i];
      if (typeof item === 'number') {
        this.options.series[i].value = item;
      } else if (typeof item === 'object') {
        this.options.series[i].value = item.value;
      }
    }
  }

  // calculate from percentage and new percentage for the progress animation
  self.options.series.forEach(function (item) {
    item.fromPercentage = item.percentage ? item.percentage : 5;
    item.percentage = (item.value - self.options.min) * 100 / (self.options.max - self.options.min);
  });

  var center = self.svg.select("text.rbc-center-text");

  // progress
  self.field.select("path.progress")
    .interrupt()
    .transition()
    .duration(self.options.animation.duration)
    .delay(function (d, i) {
      // delay between each item
      return i * self.options.animation.delay;
    })
    .ease("elastic")
    .attrTween("d", function (item) {
      var interpolator = d3.interpolateNumber(item.fromPercentage, item.percentage);
      return function (t) {
        item.percentage = interpolator(t);
        return self.progress(item);
      };
    })
    .tween("center", function (item) {
      // Execute callbacks on each line
      if (self.options.center) {
        var interpolate = self.options.round ? d3.interpolateRound : d3.interpolateNumber;
        var interpolator = interpolate(item.previousValue || 0, item.value);
        return function (t) {
          center
            .selectAll('tspan')
            .each(function () {
              if (this.callback) {
                d3.select(this).text(this.callback(interpolator(t), item.index, item));
              }
            });
        };
      }
    })
    .tween("interpolate-color", function (item) {
      if (item.color.interpolate && item.color.interpolate.length == 2) {
        var colorInterpolator = d3.interpolateHsl(item.color.interpolate[0], item.color.interpolate[1]);

        return function (t) {
          var color = colorInterpolator(item.percentage / 100);
          d3.select(this).style('fill', color);
          d3.select(this.parentNode).select('path.bg').style('fill', color);
        };
      }
    });
};

/**
 * Remove svg and clean some references
 */
RadialProgressChart.prototype.destroy = function () {
  this.svg.remove();
  delete this.svg;
};

/**
 * Detach and normalize user's options input.
 */
RadialProgressChart.normalizeOptions = function (options) {
  if (!options || typeof options !== 'object') {
    options = {};
  }

  var _options = {
    diameter: options.diameter || 100,
    stroke: {
      width: options.stroke && options.stroke.width || 40,
      gap: options.stroke && options.stroke.gap || 2
    },
    shadow: {
      width: (!options.shadow || options.shadow.width === null) ? 4 : options.shadow.width
    },
    animation: {
      duration: options.animation && options.animation.duration || 1750,
      delay: options.animation && options.animation.delay || 200
    },
    min: options.min || 0,
    max: options.max || 100,
    round: options.round !== undefined ? !!options.round : true,
    series: options.series || [],
    center: RadialProgressChart.normalizeCenter(options.center)
  };

  var defaultColorsIterator = new RadialProgressChart.ColorsIterator();
  for (var i = 0, length = _options.series.length; i < length; i++) {
    var item = options.series[i];

    // convert number to object
    if (typeof item === 'number') {
      item = {value: item};
    }

    _options.series[i] = {
      index: i,
      value: item.value,
      labelStart: item.labelStart,
      color: RadialProgressChart.normalizeColor(item.color, defaultColorsIterator)
    };
  }

  return _options;
};

/**
 * Normalize different notations of color property
 *
 * @param {String|Array|Object} color
 * @example '#fe08b5'
 * @example { solid: '#fe08b5', background: '#000000' }
 * @example ['#000000', '#ff0000']
 * @example {
                linearGradient: { x1: '0%', y1: '100%', x2: '50%', y2: '0%'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 * @example {
                radialGradient: {cx: '60', cy: '60', r: '50'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 *
 */
RadialProgressChart.normalizeColor = function (color, defaultColorsIterator) {

  if (!color) {
    color = {solid: defaultColorsIterator.next()};
  } else if (typeof color === 'string') {
    color = {solid: color};
  } else if (Array.isArray(color)) {
    color = {interpolate: color};
  } else if (typeof color === 'object') {
    if (!color.solid && !color.interpolate && !color.linearGradient && !color.radialGradient) {
      color.solid = defaultColorsIterator.next();
    }
  }

  // Validate interpolate syntax
  if (color.interpolate) {
    if (color.interpolate.length !== 2) {
      throw new Error('interpolate array should contain two colors');
    }
  }

  // Validate gradient syntax
  if (color.linearGradient || color.radialGradient) {
    if (!color.stops || !Array.isArray(color.stops) || color.stops.length !== 2) {
      throw new Error('gradient syntax is malformed');
    }
  }

  // Set background when is not provided
  if (!color.background) {
    if (color.solid) {
      color.background = color.solid;
    } else if (color.interpolate) {
      color.background = color.interpolate[0];
    } else if (color.linearGradient || color.radialGradient) {
      color.background = color.stops[0]['stop-color'];
    }
  }

  return color;

};


/**
 * Normalize different notations of center property
 *
 * @param {String|Array|Function|Object} center
 * @example 'foo bar'
 * @example { content: 'foo bar', x: 10, y: 4 }
 * @example function(value, index, item) {}
 * @example ['foo bar', function(value, index, item) {}]
 */
RadialProgressChart.normalizeCenter = function (center) {
  if (!center) return null;

  // Convert to object notation
  if (center.constructor !== Object) {
    center = {content: center};
  }

  // Defaults
  center.content = center.content || [];
  center.x = center.x || 0;
  center.y = center.y || 0;

  // Convert content to array notation
  if (!Array.isArray(center.content)) {
    center.content = [center.content];
  }

  return center;
};

// Linear or Radial Gradient internal object
RadialProgressChart.Gradient = (function () {
  function Gradient() {
  }

  Gradient.toSVGElement = function (id, options) {
    var gradientType = options.linearGradient ? 'linearGradient' : 'radialGradient';
    var gradient = d3.select(document.createElementNS(d3.ns.prefix.svg, gradientType))
      .attr(options[gradientType])
      .attr('id', id);

    options.stops.forEach(function (stopAttrs) {
      gradient.append("svg:stop").attr(stopAttrs);
    });

    this.background = options.stops[0]['stop-color'];

    return gradient.node();
  };

  return Gradient;
})();

// Default colors iterator
RadialProgressChart.ColorsIterator = (function () {

  ColorsIterator.DEFAULT_COLORS = ["#1ad5de", "#a0ff03", "#e90b3a", '#ff9500', '#007aff', '#ffcc00', '#5856d6', '#8e8e93'];

  function ColorsIterator() {
    this.index = 0;
  }

  ColorsIterator.prototype.next = function () {
    if (this.index === ColorsIterator.DEFAULT_COLORS.length) {
      this.index = 0;
    }

    return ColorsIterator.DEFAULT_COLORS[this.index++];
  };

  return ColorsIterator;
})();


// Export RadialProgressChart object
if (typeof module !== "undefined")module.exports = RadialProgressChart;

},{"d3":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkMztcblxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmZ1bmN0aW9uIFJhZGlhbFByb2dyZXNzQ2hhcnQocXVlcnksIG9wdGlvbnMpIHtcblxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXG4gIGQzID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kMykgPyB3aW5kb3cuZDMgOiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKFwiZDNcIikgOiB1bmRlZmluZWQ7XG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICAvLyBpbnRlcm5hbCAgdmFyaWFibGVzXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXG4gICAgLCBoZWlnaHQgPSB3aWR0aFxuICAgICwgZGltID0gXCIwIDAgXCIgKyBoZWlnaHQgKyBcIiBcIiArIHdpZHRoXG4gICAgLCDPhCA9IDIgKiBNYXRoLlBJXG4gICAgLCBpbm5lciA9IFtdXG4gICAgLCBvdXRlciA9IFtdO1xuXG4gIGZ1bmN0aW9uIGlubmVyUmFkaXVzKGl0ZW0pIHtcbiAgICB2YXIgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF07XG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcblxuICAgIC8vIGZpcnN0IHJpbmcgYmFzZWQgb24gZGlhbWV0ZXIgYW5kIHRoZSByZXN0IGJhc2VkIG9uIHRoZSBwcmV2aW91cyBvdXRlciByYWRpdXMgcGx1cyBnYXBcbiAgICByYWRpdXMgPSBpdGVtLmluZGV4ID09PSAwID8gc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiA6IG91dGVyW2l0ZW0uaW5kZXggLSAxXSArIHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwO1xuICAgIGlubmVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBmdW5jdGlvbiBvdXRlclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IG91dGVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBiYXNlZCBvbiB0aGUgcHJldmlvdXMgaW5uZXIgcmFkaXVzICsgc3Ryb2tlIHdpZHRoXG4gICAgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoO1xuICAgIG91dGVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBzZWxmLnByb2dyZXNzID0gZDMuc3ZnLmFyYygpXG4gICAgLnN0YXJ0QW5nbGUoMClcbiAgICAuZW5kQW5nbGUoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcbiAgICB9KVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpXG4gICAgLmNvcm5lclJhZGl1cyhmdW5jdGlvbiAoZCkge1xuICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgZDMgYnVnIGh0dHBzOi8vZ2l0aHViLmNvbS9tYm9zdG9jay9kMy9pc3N1ZXMvMjI0OVxuICAgICAgLy8gUmVkdWNlIGNvcm5lciByYWRpdXMgd2hlbiBjb3JuZXJzIGFyZSBjbG9zZSBlYWNoIG90aGVyXG4gICAgICB2YXIgbSA9IGQucGVyY2VudGFnZSA+PSA5MCA/ICgxMDAgLSBkLnBlcmNlbnRhZ2UpICogMC4xIDogMTtcbiAgICAgIHJldHVybiAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDIpICogbTtcbiAgICB9KTtcblxuICB2YXIgYmFja2dyb3VuZCA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKM+EKVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxuICAgIC5hdHRyKFwicHJlc2VydmVBc3BlY3RSYXRpb1wiLFwieE1pbllNaW4gbWVldFwiKVxuICAgIC5hdHRyKFwidmlld0JveFwiLCBkaW0pXG4gICAgLmFwcGVuZChcImdcIilcbiAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIHdpZHRoIC8gMiArIFwiLFwiICsgaGVpZ2h0IC8gMiArIFwiKVwiKTtcblxuICAvLyBhZGQgZ3JhZGllbnRzIGRlZnNcbiAgdmFyIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICB2YXIgZ3JhZGllbnQgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50LnRvU1ZHRWxlbWVudCgnZ3JhZGllbnQnICsgaXRlbS5pbmRleCwgaXRlbS5jb2xvcik7XG4gICAgICBkZWZzLm5vZGUoKS5hcHBlbmRDaGlsZChncmFkaWVudCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBhZGQgc2hhZG93cyBkZWZzXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgdmFyIGRyb3BzaGFkb3dJZCA9IFwiZHJvcHNoYWRvdy1cIiArIE1hdGgucmFuZG9tKCk7XG4gIHZhciBmaWx0ZXIgPSBkZWZzLmFwcGVuZChcImZpbHRlclwiKS5hdHRyKFwiaWRcIiwgZHJvcHNoYWRvd0lkKTtcbiAgaWYoc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aCA+IDApIHtcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVHYXVzc2lhbkJsdXJcIilcbiAgICAgIC5hdHRyKFwiaW5cIiwgXCJTb3VyY2VBbHBoYVwiKVxuICAgICAgLmF0dHIoXCJzdGREZXZpYXRpb25cIiwgc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aClcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwiYmx1clwiKTtcblxuICAgIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcImJsdXJcIilcbiAgICAgIC5hdHRyKFwiZHhcIiwgMSlcbiAgICAgIC5hdHRyKFwiZHlcIiwgMSlcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgfVxuXG4gIHZhciBmZU1lcmdlID0gZmlsdGVyLmFwcGVuZChcImZlTWVyZ2VcIik7XG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJTb3VyY2VHcmFwaGljXCIpO1xuXG4gIC8vIGFkZCBpbm5lciB0ZXh0XG4gIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgc2VsZi5zdmcuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ3JiYy1jZW50ZXItdGV4dCcpXG4gICAgICAuYXR0cihcInRleHQtYW5jaG9yXCIsIFwibWlkZGxlXCIpXG4gICAgICAuYXR0cigneCcsIHNlbGYub3B0aW9ucy5jZW50ZXIueCArICdweCcpXG4gICAgICAuYXR0cigneScsIHNlbGYub3B0aW9ucy5jZW50ZXIueSArICdweCcpXG4gICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAuZGF0YShzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQpLmVudGVyKClcbiAgICAgIC5hcHBlbmQoJ3RzcGFuJylcbiAgICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIC8vIFNpbmdsZSBsaW5lcyBjYW4gZWFzaWx5IGNlbnRlcmVkIGluIHRoZSBtaWRkbGUgdXNpbmcgZG9taW5hbnQtYmFzZWxpbmUsIG11bHRpbGluZSBuZWVkIHRvIHVzZSB5XG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuICdjZW50cmFsJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5hdHRyKCdjbGFzcycsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIHJldHVybiAncmJjLWNlbnRlci10ZXh0LWxpbmUnICsgaTtcbiAgICAgIH0pXG4gICAgICAuYXR0cigneCcsIDApXG4gICAgICAuYXR0cignZHknLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICByZXR1cm4gJzEuMWVtJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSBkO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRleHQoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBhZGQgcmluZyBzdHJ1Y3R1cmVcbiAgc2VsZi5maWVsZCA9IHNlbGYuc3ZnLnNlbGVjdEFsbChcImdcIilcbiAgICAuZGF0YShzZXJpZXMpXG4gICAgLmVudGVyKCkuYXBwZW5kKFwiZ1wiKTtcblxuICB2YXIgcHJvZ3Jlc3NSaW5nID0gc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpXG4gICAgLmF0dHIoXCJjbGFzc1wiLCBcInByb2dyZXNzXCIpXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3Iuc29saWQpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uY29sb3Iuc29saWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgICAgcmV0dXJuIFwidXJsKCNncmFkaWVudFwiICsgaXRlbS5pbmRleCArICcpJztcbiAgICAgIH1cbiAgICB9KTtcblxuICBpZiAoc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aCA+IDApIHtcbiAgICBwcm9ncmVzc1JpbmcuYXR0cihcImZpbHRlclwiLCBcInVybCgjXCIgKyBkcm9wc2hhZG93SWQgK1wiKVwiKTtcbiAgfVxuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJiZ1wiKVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmNvbG9yLmJhY2tncm91bmQ7XG4gICAgfSlcbiAgICAuc3R5bGUoXCJvcGFjaXR5XCIsIDAuMilcbiAgICAuYXR0cihcImRcIiwgYmFja2dyb3VuZCk7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgLmNsYXNzZWQoJ3JiYy1sYWJlbCByYmMtbGFiZWwtc3RhcnQnLCB0cnVlKVxuICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgXCJjZW50cmFsXCIpXG4gICAgLmF0dHIoXCJ4XCIsIFwiMTBcIilcbiAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiAtKFxuICAgICAgICBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyICtcbiAgICAgICAgaXRlbS5pbmRleCAqIChzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcCArIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGgpICtcbiAgICAgICAgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDJcbiAgICAgICAgKTtcbiAgICB9KVxuICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xuICAgIH0pO1xuXG4gIHNlbGYudXBkYXRlKCk7XG59XG5cbi8qKlxuICogVXBkYXRlIGRhdGEgdG8gYmUgdmlzdWFsaXplZCBpbiB0aGUgY2hhcnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGRhdGEgT3B0aW9uYWwgZGF0YSB5b3UnZCBsaWtlIHRvIHNldCBmb3IgdGhlIGNoYXJ0IGJlZm9yZSBpdCB3aWxsIHVwZGF0ZS4gSWYgbm90IHNwZWNpZmllZCB0aGUgdXBkYXRlIG1ldGhvZCB3aWxsIHVzZSB0aGUgZGF0YSB0aGF0IGlzIGFscmVhZHkgY29uZmlndXJlZCB3aXRoIHRoZSBjaGFydC5cbiAqIEBleGFtcGxlIHVwZGF0ZShbNzAsIDEwLCA0NV0pXG4gKiBAZXhhbXBsZSB1cGRhdGUoe3NlcmllczogW3t2YWx1ZTogNzB9LCAxMCwgNDVdfSlcbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBwYXJzZSBuZXcgZGF0YVxuICBpZiAoZGF0YSkge1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGRhdGEgPSBbZGF0YV07XG4gICAgfVxuXG4gICAgdmFyIHNlcmllcztcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhLnNlcmllcyB8fCBbXTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5wcmV2aW91c1ZhbHVlID0gdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZTtcblxuICAgICAgdmFyIGl0ZW0gPSBzZXJpZXNbaV07XG4gICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW0udmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsY3VsYXRlIGZyb20gcGVyY2VudGFnZSBhbmQgbmV3IHBlcmNlbnRhZ2UgZm9yIHRoZSBwcm9ncmVzcyBhbmltYXRpb25cbiAgc2VsZi5vcHRpb25zLnNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgaXRlbS5mcm9tUGVyY2VudGFnZSA9IGl0ZW0ucGVyY2VudGFnZSA/IGl0ZW0ucGVyY2VudGFnZSA6IDU7XG4gICAgaXRlbS5wZXJjZW50YWdlID0gKGl0ZW0udmFsdWUgLSBzZWxmLm9wdGlvbnMubWluKSAqIDEwMCAvIChzZWxmLm9wdGlvbnMubWF4IC0gc2VsZi5vcHRpb25zLm1pbik7XG4gIH0pO1xuXG4gIHZhciBjZW50ZXIgPSBzZWxmLnN2Zy5zZWxlY3QoXCJ0ZXh0LnJiYy1jZW50ZXItdGV4dFwiKTtcblxuICAvLyBwcm9ncmVzc1xuICBzZWxmLmZpZWxkLnNlbGVjdChcInBhdGgucHJvZ3Jlc3NcIilcbiAgICAuaW50ZXJydXB0KClcbiAgICAudHJhbnNpdGlvbigpXG4gICAgLmR1cmF0aW9uKHNlbGYub3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24pXG4gICAgLmRlbGF5KGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAvLyBkZWxheSBiZXR3ZWVuIGVhY2ggaXRlbVxuICAgICAgcmV0dXJuIGkgKiBzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5O1xuICAgIH0pXG4gICAgLmVhc2UoXCJlbGFzdGljXCIpXG4gICAgLmF0dHJUd2VlbihcImRcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZU51bWJlcihpdGVtLmZyb21QZXJjZW50YWdlLCBpdGVtLnBlcmNlbnRhZ2UpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgIGl0ZW0ucGVyY2VudGFnZSA9IGludGVycG9sYXRvcih0KTtcbiAgICAgICAgcmV0dXJuIHNlbGYucHJvZ3Jlc3MoaXRlbSk7XG4gICAgICB9O1xuICAgIH0pXG4gICAgLnR3ZWVuKFwiY2VudGVyXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAvLyBFeGVjdXRlIGNhbGxiYWNrcyBvbiBlYWNoIGxpbmVcbiAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgICAgIHZhciBpbnRlcnBvbGF0ZSA9IHNlbGYub3B0aW9ucy5yb3VuZCA/IGQzLmludGVycG9sYXRlUm91bmQgOiBkMy5pbnRlcnBvbGF0ZU51bWJlcjtcbiAgICAgICAgdmFyIGludGVycG9sYXRvciA9IGludGVycG9sYXRlKGl0ZW0ucHJldmlvdXNWYWx1ZSB8fCAwLCBpdGVtLnZhbHVlKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgY2VudGVyXG4gICAgICAgICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAgICAgICAuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnRleHQodGhpcy5jYWxsYmFjayhpbnRlcnBvbGF0b3IodCksIGl0ZW0uaW5kZXgsIGl0ZW0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAudHdlZW4oXCJpbnRlcnBvbGF0ZS1jb2xvclwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUgJiYgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggPT0gMikge1xuICAgICAgICB2YXIgY29sb3JJbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZUhzbChpdGVtLmNvbG9yLmludGVycG9sYXRlWzBdLCBpdGVtLmNvbG9yLmludGVycG9sYXRlWzFdKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICB2YXIgY29sb3IgPSBjb2xvckludGVycG9sYXRvcihpdGVtLnBlcmNlbnRhZ2UgLyAxMDApO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcy5wYXJlbnROb2RlKS5zZWxlY3QoJ3BhdGguYmcnKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHN2ZyBhbmQgY2xlYW4gc29tZSByZWZlcmVuY2VzXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuc3ZnLnJlbW92ZSgpO1xuICBkZWxldGUgdGhpcy5zdmc7XG59O1xuXG4vKipcbiAqIERldGFjaCBhbmQgbm9ybWFsaXplIHVzZXIncyBvcHRpb25zIGlucHV0LlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgdmFyIF9vcHRpb25zID0ge1xuICAgIGRpYW1ldGVyOiBvcHRpb25zLmRpYW1ldGVyIHx8IDEwMCxcbiAgICBzdHJva2U6IHtcbiAgICAgIHdpZHRoOiBvcHRpb25zLnN0cm9rZSAmJiBvcHRpb25zLnN0cm9rZS53aWR0aCB8fCA0MCxcbiAgICAgIGdhcDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2UuZ2FwIHx8IDJcbiAgICB9LFxuICAgIHNoYWRvdzoge1xuICAgICAgd2lkdGg6ICghb3B0aW9ucy5zaGFkb3cgfHwgb3B0aW9ucy5zaGFkb3cud2lkdGggPT09IG51bGwpID8gNCA6IG9wdGlvbnMuc2hhZG93LndpZHRoXG4gICAgfSxcbiAgICBhbmltYXRpb246IHtcbiAgICAgIGR1cmF0aW9uOiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbiB8fCAxNzUwLFxuICAgICAgZGVsYXk6IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5IHx8IDIwMFxuICAgIH0sXG4gICAgbWluOiBvcHRpb25zLm1pbiB8fCAwLFxuICAgIG1heDogb3B0aW9ucy5tYXggfHwgMTAwLFxuICAgIHJvdW5kOiBvcHRpb25zLnJvdW5kICE9PSB1bmRlZmluZWQgPyAhIW9wdGlvbnMucm91bmQgOiB0cnVlLFxuICAgIHNlcmllczogb3B0aW9ucy5zZXJpZXMgfHwgW10sXG4gICAgY2VudGVyOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlcihvcHRpb25zLmNlbnRlcilcbiAgfTtcblxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9vcHRpb25zLnNlcmllcy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gb3B0aW9ucy5zZXJpZXNbaV07XG5cbiAgICAvLyBjb252ZXJ0IG51bWJlciB0byBvYmplY3RcbiAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcbiAgICB9XG5cbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XG4gICAgICBpbmRleDogaSxcbiAgICAgIHZhbHVlOiBpdGVtLnZhbHVlLFxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxuICAgICAgY29sb3I6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IoaXRlbS5jb2xvciwgZGVmYXVsdENvbG9yc0l0ZXJhdG9yKVxuICAgIH07XG4gIH1cblxuICByZXR1cm4gX29wdGlvbnM7XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNvbG9yIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8T2JqZWN0fSBjb2xvclxuICogQGV4YW1wbGUgJyNmZTA4YjUnXG4gKiBAZXhhbXBsZSB7IHNvbGlkOiAnI2ZlMDhiNScsIGJhY2tncm91bmQ6ICcjMDAwMDAwJyB9XG4gKiBAZXhhbXBsZSBbJyMwMDAwMDAnLCAnI2ZmMDAwMCddXG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgbGluZWFyR3JhZGllbnQ6IHsgeDE6ICcwJScsIHkxOiAnMTAwJScsIHgyOiAnNTAlJywgeTI6ICcwJSd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgcmFkaWFsR3JhZGllbnQ6IHtjeDogJzYwJywgY3k6ICc2MCcsIHI6ICc1MCd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNvbG9yID0gZnVuY3Rpb24gKGNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpIHtcblxuICBpZiAoIWNvbG9yKSB7XG4gICAgY29sb3IgPSB7c29saWQ6IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCl9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogY29sb3J9O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY29sb3IpKSB7XG4gICAgY29sb3IgPSB7aW50ZXJwb2xhdGU6IGNvbG9yfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKCFjb2xvci5zb2xpZCAmJiAhY29sb3IuaW50ZXJwb2xhdGUgJiYgIWNvbG9yLmxpbmVhckdyYWRpZW50ICYmICFjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3Iuc29saWQgPSBkZWZhdWx0Q29sb3JzSXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGludGVycG9sYXRlIHN5bnRheFxuICBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICBpZiAoY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVycG9sYXRlIGFycmF5IHNob3VsZCBjb250YWluIHR3byBjb2xvcnMnKTtcbiAgICB9XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBncmFkaWVudCBzeW50YXhcbiAgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgaWYgKCFjb2xvci5zdG9wcyB8fCAhQXJyYXkuaXNBcnJheShjb2xvci5zdG9wcykgfHwgY29sb3Iuc3RvcHMubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dyYWRpZW50IHN5bnRheCBpcyBtYWxmb3JtZWQnKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXQgYmFja2dyb3VuZCB3aGVuIGlzIG5vdCBwcm92aWRlZFxuICBpZiAoIWNvbG9yLmJhY2tncm91bmQpIHtcbiAgICBpZiAoY29sb3Iuc29saWQpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5zb2xpZDtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3IuaW50ZXJwb2xhdGVbMF07XG4gICAgfSBlbHNlIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbG9yO1xuXG59O1xuXG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY2VudGVyIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8RnVuY3Rpb258T2JqZWN0fSBjZW50ZXJcbiAqIEBleGFtcGxlICdmb28gYmFyJ1xuICogQGV4YW1wbGUgeyBjb250ZW50OiAnZm9vIGJhcicsIHg6IDEwLCB5OiA0IH1cbiAqIEBleGFtcGxlIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31cbiAqIEBleGFtcGxlIFsnZm9vIGJhcicsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31dXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyID0gZnVuY3Rpb24gKGNlbnRlcikge1xuICBpZiAoIWNlbnRlcikgcmV0dXJuIG51bGw7XG5cbiAgLy8gQ29udmVydCB0byBvYmplY3Qgbm90YXRpb25cbiAgaWYgKGNlbnRlci5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0KSB7XG4gICAgY2VudGVyID0ge2NvbnRlbnQ6IGNlbnRlcn07XG4gIH1cblxuICAvLyBEZWZhdWx0c1xuICBjZW50ZXIuY29udGVudCA9IGNlbnRlci5jb250ZW50IHx8IFtdO1xuICBjZW50ZXIueCA9IGNlbnRlci54IHx8IDA7XG4gIGNlbnRlci55ID0gY2VudGVyLnkgfHwgMDtcblxuICAvLyBDb252ZXJ0IGNvbnRlbnQgdG8gYXJyYXkgbm90YXRpb25cbiAgaWYgKCFBcnJheS5pc0FycmF5KGNlbnRlci5jb250ZW50KSkge1xuICAgIGNlbnRlci5jb250ZW50ID0gW2NlbnRlci5jb250ZW50XTtcbiAgfVxuXG4gIHJldHVybiBjZW50ZXI7XG59O1xuXG4vLyBMaW5lYXIgb3IgUmFkaWFsIEdyYWRpZW50IGludGVybmFsIG9iamVjdFxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudCA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEdyYWRpZW50KCkge1xuICB9XG5cbiAgR3JhZGllbnQudG9TVkdFbGVtZW50ID0gZnVuY3Rpb24gKGlkLCBvcHRpb25zKSB7XG4gICAgdmFyIGdyYWRpZW50VHlwZSA9IG9wdGlvbnMubGluZWFyR3JhZGllbnQgPyAnbGluZWFyR3JhZGllbnQnIDogJ3JhZGlhbEdyYWRpZW50JztcbiAgICB2YXIgZ3JhZGllbnQgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKGQzLm5zLnByZWZpeC5zdmcsIGdyYWRpZW50VHlwZSkpXG4gICAgICAuYXR0cihvcHRpb25zW2dyYWRpZW50VHlwZV0pXG4gICAgICAuYXR0cignaWQnLCBpZCk7XG5cbiAgICBvcHRpb25zLnN0b3BzLmZvckVhY2goZnVuY3Rpb24gKHN0b3BBdHRycykge1xuICAgICAgZ3JhZGllbnQuYXBwZW5kKFwic3ZnOnN0b3BcIikuYXR0cihzdG9wQXR0cnMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrZ3JvdW5kID0gb3B0aW9ucy5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xuXG4gICAgcmV0dXJuIGdyYWRpZW50Lm5vZGUoKTtcbiAgfTtcblxuICByZXR1cm4gR3JhZGllbnQ7XG59KSgpO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBpdGVyYXRvclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvciA9IChmdW5jdGlvbiAoKSB7XG5cbiAgQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMgPSBbXCIjMWFkNWRlXCIsIFwiI2EwZmYwM1wiLCBcIiNlOTBiM2FcIiwgJyNmZjk1MDAnLCAnIzAwN2FmZicsICcjZmZjYzAwJywgJyM1ODU2ZDYnLCAnIzhlOGU5MyddO1xuXG4gIGZ1bmN0aW9uIENvbG9yc0l0ZXJhdG9yKCkge1xuICAgIHRoaXMuaW5kZXggPSAwO1xuICB9XG5cbiAgQ29sb3JzSXRlcmF0b3IucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTLmxlbmd0aCkge1xuICAgICAgdGhpcy5pbmRleCA9IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTW3RoaXMuaW5kZXgrK107XG4gIH07XG5cbiAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yO1xufSkoKTtcblxuXG4vLyBFeHBvcnQgUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKW1vZHVsZS5leHBvcnRzID0gUmFkaWFsUHJvZ3Jlc3NDaGFydDtcbiJdfQ==
