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
      gap: (!options.stroke || options.stroke.gap === undefined) ? 2 : options.stroke.gap
    },
    shadow: {
      width: (!options.shadow || options.shadow.width === null) ? 4 : options.shadow.width
    },
    animation: {
      duration: options.animation && options.animation.duration !== undefined ? options.animation.duration : 1750,
      delay: options.animation && options.animation.delay !== undefined ? options.animation.delay : 200
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

//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgZDM7XHJcblxyXG4vLyBSYWRpYWxQcm9ncmVzc0NoYXJ0IG9iamVjdFxyXG5mdW5jdGlvbiBSYWRpYWxQcm9ncmVzc0NoYXJ0KHF1ZXJ5LCBvcHRpb25zKSB7XHJcblxyXG4gIC8vIHZlcmlmeSBkMyBpcyBsb2FkZWRcclxuICBkMyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZDMpID8gd2luZG93LmQzIDogdHlwZW9mIHJlcXVpcmUgIT09ICd1bmRlZmluZWQnID8gcmVxdWlyZShcImQzXCIpIDogdW5kZWZpbmVkO1xyXG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcclxuXHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcclxuXHJcbiAgLy8gaW50ZXJuYWwgIHZhcmlhYmxlc1xyXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXHJcbiAgICAsIHdpZHRoID0gMTUgKyAoKHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIpICsgKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggKiBzZWxmLm9wdGlvbnMuc2VyaWVzLmxlbmd0aCkgKyAoc2VsZi5vcHRpb25zLnN0cm9rZS5nYXAgKiBzZWxmLm9wdGlvbnMuc2VyaWVzLmxlbmd0aCAtIDEpKSAqIDJcclxuICAgICwgaGVpZ2h0ID0gd2lkdGhcclxuICAgICwgZGltID0gXCIwIDAgXCIgKyBoZWlnaHQgKyBcIiBcIiArIHdpZHRoXHJcbiAgICAsIM+EID0gMiAqIE1hdGguUElcclxuICAgICwgaW5uZXIgPSBbXVxyXG4gICAgLCBvdXRlciA9IFtdO1xyXG5cclxuICBmdW5jdGlvbiBpbm5lclJhZGl1cyhpdGVtKSB7XHJcbiAgICB2YXIgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF07XHJcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xyXG5cclxuICAgIC8vIGZpcnN0IHJpbmcgYmFzZWQgb24gZGlhbWV0ZXIgYW5kIHRoZSByZXN0IGJhc2VkIG9uIHRoZSBwcmV2aW91cyBvdXRlciByYWRpdXMgcGx1cyBnYXBcclxuICAgIHJhZGl1cyA9IGl0ZW0uaW5kZXggPT09IDAgPyBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyIDogb3V0ZXJbaXRlbS5pbmRleCAtIDFdICsgc2VsZi5vcHRpb25zLnN0cm9rZS5nYXA7XHJcbiAgICBpbm5lcltpdGVtLmluZGV4XSA9IHJhZGl1cztcclxuICAgIHJldHVybiByYWRpdXM7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBvdXRlclJhZGl1cyhpdGVtKSB7XHJcbiAgICB2YXIgcmFkaXVzID0gb3V0ZXJbaXRlbS5pbmRleF07XHJcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xyXG5cclxuICAgIC8vIGJhc2VkIG9uIHRoZSBwcmV2aW91cyBpbm5lciByYWRpdXMgKyBzdHJva2Ugd2lkdGhcclxuICAgIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aDtcclxuICAgIG91dGVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xyXG4gICAgcmV0dXJuIHJhZGl1cztcclxuICB9XHJcblxyXG4gIHNlbGYucHJvZ3Jlc3MgPSBkMy5zdmcuYXJjKClcclxuICAgIC5zdGFydEFuZ2xlKDApXHJcbiAgICAuZW5kQW5nbGUoZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgcmV0dXJuIGl0ZW0ucGVyY2VudGFnZSAvIDEwMCAqIM+EO1xyXG4gICAgfSlcclxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcclxuICAgIC5vdXRlclJhZGl1cyhvdXRlclJhZGl1cylcclxuICAgIC5jb3JuZXJSYWRpdXMoZnVuY3Rpb24gKGQpIHtcclxuICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgZDMgYnVnIGh0dHBzOi8vZ2l0aHViLmNvbS9tYm9zdG9jay9kMy9pc3N1ZXMvMjI0OVxyXG4gICAgICAvLyBSZWR1Y2UgY29ybmVyIHJhZGl1cyB3aGVuIGNvcm5lcnMgYXJlIGNsb3NlIGVhY2ggb3RoZXJcclxuICAgICAgdmFyIG0gPSBkLnBlcmNlbnRhZ2UgPj0gOTAgPyAoMTAwIC0gZC5wZXJjZW50YWdlKSAqIDAuMSA6IDE7XHJcbiAgICAgIHJldHVybiAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDIpICogbTtcclxuICAgIH0pO1xyXG5cclxuICB2YXIgYmFja2dyb3VuZCA9IGQzLnN2Zy5hcmMoKVxyXG4gICAgLnN0YXJ0QW5nbGUoMClcclxuICAgIC5lbmRBbmdsZSjPhClcclxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcclxuICAgIC5vdXRlclJhZGl1cyhvdXRlclJhZGl1cyk7XHJcblxyXG4gIC8vIGNyZWF0ZSBzdmdcclxuICBzZWxmLnN2ZyA9IGQzLnNlbGVjdChxdWVyeSkuYXBwZW5kKFwic3ZnXCIpXHJcbiAgICAuYXR0cihcInByZXNlcnZlQXNwZWN0UmF0aW9cIixcInhNaW5ZTWluIG1lZXRcIilcclxuICAgIC5hdHRyKFwidmlld0JveFwiLCBkaW0pXHJcbiAgICAuYXBwZW5kKFwiZ1wiKVxyXG4gICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyB3aWR0aCAvIDIgKyBcIixcIiArIGhlaWdodCAvIDIgKyBcIilcIik7XHJcblxyXG4gIC8vIGFkZCBncmFkaWVudHMgZGVmc1xyXG4gIHZhciBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XHJcbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcclxuICAgICAgdmFyIGdyYWRpZW50ID0gUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudC50b1NWR0VsZW1lbnQoJ2dyYWRpZW50JyArIGl0ZW0uaW5kZXgsIGl0ZW0uY29sb3IpO1xyXG4gICAgICBkZWZzLm5vZGUoKS5hcHBlbmRDaGlsZChncmFkaWVudCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIC8vIGFkZCBzaGFkb3dzIGRlZnNcclxuICBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XHJcbiAgdmFyIGRyb3BzaGFkb3dJZCA9IFwiZHJvcHNoYWRvdy1cIiArIE1hdGgucmFuZG9tKCk7XHJcbiAgdmFyIGZpbHRlciA9IGRlZnMuYXBwZW5kKFwiZmlsdGVyXCIpLmF0dHIoXCJpZFwiLCBkcm9wc2hhZG93SWQpO1xyXG4gIGlmKHNlbGYub3B0aW9ucy5zaGFkb3cud2lkdGggPiAwKSB7XHJcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVHYXVzc2lhbkJsdXJcIilcclxuICAgICAgLmF0dHIoXCJpblwiLCBcIlNvdXJjZUFscGhhXCIpXHJcbiAgICAgIC5hdHRyKFwic3RkRGV2aWF0aW9uXCIsIHNlbGYub3B0aW9ucy5zaGFkb3cud2lkdGgpXHJcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwiYmx1clwiKTtcclxuXHJcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVPZmZzZXRcIilcclxuICAgICAgLmF0dHIoXCJpblwiLCBcImJsdXJcIilcclxuICAgICAgLmF0dHIoXCJkeFwiLCAxKVxyXG4gICAgICAuYXR0cihcImR5XCIsIDEpXHJcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwib2Zmc2V0Qmx1clwiKTtcclxuICB9XHJcblxyXG4gIHZhciBmZU1lcmdlID0gZmlsdGVyLmFwcGVuZChcImZlTWVyZ2VcIik7XHJcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJvZmZzZXRCbHVyXCIpO1xyXG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwiU291cmNlR3JhcGhpY1wiKTtcclxuXHJcbiAgLy8gYWRkIGlubmVyIHRleHRcclxuICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlcikge1xyXG4gICAgc2VsZi5zdmcuYXBwZW5kKFwidGV4dFwiKVxyXG4gICAgICAuYXR0cignY2xhc3MnLCAncmJjLWNlbnRlci10ZXh0JylcclxuICAgICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxyXG4gICAgICAuYXR0cigneCcsIHNlbGYub3B0aW9ucy5jZW50ZXIueCArICdweCcpXHJcbiAgICAgIC5hdHRyKCd5Jywgc2VsZi5vcHRpb25zLmNlbnRlci55ICsgJ3B4JylcclxuICAgICAgLnNlbGVjdEFsbCgndHNwYW4nKVxyXG4gICAgICAuZGF0YShzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQpLmVudGVyKClcclxuICAgICAgLmFwcGVuZCgndHNwYW4nKVxyXG4gICAgICAuYXR0cihcImRvbWluYW50LWJhc2VsaW5lXCIsIGZ1bmN0aW9uICgpIHtcclxuXHJcbiAgICAgICAgLy8gU2luZ2xlIGxpbmVzIGNhbiBlYXNpbHkgY2VudGVyZWQgaW4gdGhlIG1pZGRsZSB1c2luZyBkb21pbmFudC1iYXNlbGluZSwgbXVsdGlsaW5lIG5lZWQgdG8gdXNlIHlcclxuICAgICAgICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlci5jb250ZW50Lmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgcmV0dXJuICdjZW50cmFsJztcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5hdHRyKCdjbGFzcycsIGZ1bmN0aW9uIChkLCBpKSB7XHJcbiAgICAgICAgcmV0dXJuICdyYmMtY2VudGVyLXRleHQtbGluZScgKyBpO1xyXG4gICAgICB9KVxyXG4gICAgICAuYXR0cigneCcsIDApXHJcbiAgICAgIC5hdHRyKCdkeScsIGZ1bmN0aW9uIChkLCBpKSB7XHJcbiAgICAgICAgaWYgKGkgPiAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gJzEuMWVtJztcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gZDtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC50ZXh0KGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgcmV0dXJuIGQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gYWRkIHJpbmcgc3RydWN0dXJlXHJcbiAgc2VsZi5maWVsZCA9IHNlbGYuc3ZnLnNlbGVjdEFsbChcImdcIilcclxuICAgIC5kYXRhKHNlcmllcylcclxuICAgIC5lbnRlcigpLmFwcGVuZChcImdcIik7XHJcblxyXG4gIHZhciBwcm9ncmVzc1JpbmcgPSBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIilcclxuICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJwcm9ncmVzc1wiKVxyXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICBpZiAoaXRlbS5jb2xvci5zb2xpZCkge1xyXG4gICAgICAgIHJldHVybiBpdGVtLmNvbG9yLnNvbGlkO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XHJcbiAgICAgICAgcmV0dXJuIFwidXJsKCNncmFkaWVudFwiICsgaXRlbS5pbmRleCArICcpJztcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gIGlmIChzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoID4gMCkge1xyXG4gICAgcHJvZ3Jlc3NSaW5nLmF0dHIoXCJmaWx0ZXJcIiwgXCJ1cmwoI1wiICsgZHJvcHNoYWRvd0lkICtcIilcIik7XHJcbiAgfVxyXG5cclxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwiYmdcIilcclxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgcmV0dXJuIGl0ZW0uY29sb3IuYmFja2dyb3VuZDtcclxuICAgIH0pXHJcbiAgICAuc3R5bGUoXCJvcGFjaXR5XCIsIDAuMilcclxuICAgIC5hdHRyKFwiZFwiLCBiYWNrZ3JvdW5kKTtcclxuXHJcbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJ0ZXh0XCIpXHJcbiAgICAuY2xhc3NlZCgncmJjLWxhYmVsIHJiYy1sYWJlbC1zdGFydCcsIHRydWUpXHJcbiAgICAuYXR0cihcImRvbWluYW50LWJhc2VsaW5lXCIsIFwiY2VudHJhbFwiKVxyXG4gICAgLmF0dHIoXCJ4XCIsIFwiMTBcIilcclxuICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICByZXR1cm4gLShcclxuICAgICAgICBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyICtcclxuICAgICAgICBpdGVtLmluZGV4ICogKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCkgK1xyXG4gICAgICAgIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyXHJcbiAgICAgICAgKTtcclxuICAgIH0pXHJcbiAgICAudGV4dChmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xyXG4gICAgfSk7XHJcblxyXG4gIHNlbGYudXBkYXRlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgZGF0YSB0byBiZSB2aXN1YWxpemVkIGluIHRoZSBjaGFydC5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGRhdGEgT3B0aW9uYWwgZGF0YSB5b3UnZCBsaWtlIHRvIHNldCBmb3IgdGhlIGNoYXJ0IGJlZm9yZSBpdCB3aWxsIHVwZGF0ZS4gSWYgbm90IHNwZWNpZmllZCB0aGUgdXBkYXRlIG1ldGhvZCB3aWxsIHVzZSB0aGUgZGF0YSB0aGF0IGlzIGFscmVhZHkgY29uZmlndXJlZCB3aXRoIHRoZSBjaGFydC5cclxuICogQGV4YW1wbGUgdXBkYXRlKFs3MCwgMTAsIDQ1XSlcclxuICogQGV4YW1wbGUgdXBkYXRlKHtzZXJpZXM6IFt7dmFsdWU6IDcwfSwgMTAsIDQ1XX0pXHJcbiAqXHJcbiAqL1xyXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoZGF0YSkge1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgLy8gcGFyc2UgbmV3IGRhdGFcclxuICBpZiAoZGF0YSkge1xyXG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnbnVtYmVyJykge1xyXG4gICAgICBkYXRhID0gW2RhdGFdO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBzZXJpZXM7XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcclxuICAgICAgc2VyaWVzID0gZGF0YTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIHNlcmllcyA9IGRhdGEuc2VyaWVzIHx8IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VyaWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0ucHJldmlvdXNWYWx1ZSA9IHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWU7XHJcblxyXG4gICAgICB2YXIgaXRlbSA9IHNlcmllc1tpXTtcclxuICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtO1xyXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtLnZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBjYWxjdWxhdGUgZnJvbSBwZXJjZW50YWdlIGFuZCBuZXcgcGVyY2VudGFnZSBmb3IgdGhlIHByb2dyZXNzIGFuaW1hdGlvblxyXG4gIHNlbGYub3B0aW9ucy5zZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgaXRlbS5mcm9tUGVyY2VudGFnZSA9IGl0ZW0ucGVyY2VudGFnZSA/IGl0ZW0ucGVyY2VudGFnZSA6IDU7XHJcbiAgICBpdGVtLnBlcmNlbnRhZ2UgPSAoaXRlbS52YWx1ZSAtIHNlbGYub3B0aW9ucy5taW4pICogMTAwIC8gKHNlbGYub3B0aW9ucy5tYXggLSBzZWxmLm9wdGlvbnMubWluKTtcclxuICB9KTtcclxuXHJcbiAgdmFyIGNlbnRlciA9IHNlbGYuc3ZnLnNlbGVjdChcInRleHQucmJjLWNlbnRlci10ZXh0XCIpO1xyXG5cclxuICAvLyBwcm9ncmVzc1xyXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwicGF0aC5wcm9ncmVzc1wiKVxyXG4gICAgLmludGVycnVwdCgpXHJcbiAgICAudHJhbnNpdGlvbigpXHJcbiAgICAuZHVyYXRpb24oc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbilcclxuICAgIC5kZWxheShmdW5jdGlvbiAoZCwgaSkge1xyXG4gICAgICAvLyBkZWxheSBiZXR3ZWVuIGVhY2ggaXRlbVxyXG4gICAgICByZXR1cm4gaSAqIHNlbGYub3B0aW9ucy5hbmltYXRpb24uZGVsYXk7XHJcbiAgICB9KVxyXG4gICAgLmVhc2UoXCJlbGFzdGljXCIpXHJcbiAgICAuYXR0clR3ZWVuKFwiZFwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICB2YXIgaW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVOdW1iZXIoaXRlbS5mcm9tUGVyY2VudGFnZSwgaXRlbS5wZXJjZW50YWdlKTtcclxuICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XHJcbiAgICAgICAgaXRlbS5wZXJjZW50YWdlID0gaW50ZXJwb2xhdG9yKHQpO1xyXG4gICAgICAgIHJldHVybiBzZWxmLnByb2dyZXNzKGl0ZW0pO1xyXG4gICAgICB9O1xyXG4gICAgfSlcclxuICAgIC50d2VlbihcImNlbnRlclwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICAvLyBFeGVjdXRlIGNhbGxiYWNrcyBvbiBlYWNoIGxpbmVcclxuICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcclxuICAgICAgICB2YXIgaW50ZXJwb2xhdGUgPSBzZWxmLm9wdGlvbnMucm91bmQgPyBkMy5pbnRlcnBvbGF0ZVJvdW5kIDogZDMuaW50ZXJwb2xhdGVOdW1iZXI7XHJcbiAgICAgICAgdmFyIGludGVycG9sYXRvciA9IGludGVycG9sYXRlKGl0ZW0ucHJldmlvdXNWYWx1ZSB8fCAwLCBpdGVtLnZhbHVlKTtcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcclxuICAgICAgICAgIGNlbnRlclxyXG4gICAgICAgICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXHJcbiAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICBpZiAodGhpcy5jYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnRleHQodGhpcy5jYWxsYmFjayhpbnRlcnBvbGF0b3IodCksIGl0ZW0uaW5kZXgsIGl0ZW0pKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgICAudHdlZW4oXCJpbnRlcnBvbGF0ZS1jb2xvclwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICBpZiAoaXRlbS5jb2xvci5pbnRlcnBvbGF0ZSAmJiBpdGVtLmNvbG9yLmludGVycG9sYXRlLmxlbmd0aCA9PSAyKSB7XHJcbiAgICAgICAgdmFyIGNvbG9ySW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVIc2woaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVswXSwgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVsxXSk7XHJcblxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xyXG4gICAgICAgICAgdmFyIGNvbG9yID0gY29sb3JJbnRlcnBvbGF0b3IoaXRlbS5wZXJjZW50YWdlIC8gMTAwKTtcclxuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcclxuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLnNlbGVjdCgncGF0aC5iZycpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBzdmcgYW5kIGNsZWFuIHNvbWUgcmVmZXJlbmNlc1xyXG4gKi9cclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcclxuICB0aGlzLnN2Zy5yZW1vdmUoKTtcclxuICBkZWxldGUgdGhpcy5zdmc7XHJcbn07XHJcblxyXG4vKipcclxuICogRGV0YWNoIGFuZCBub3JtYWxpemUgdXNlcidzIG9wdGlvbnMgaW5wdXQuXHJcbiAqL1xyXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gIGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcclxuICAgIG9wdGlvbnMgPSB7fTtcclxuICB9XHJcblxyXG4gIHZhciBfb3B0aW9ucyA9IHtcclxuICAgIGRpYW1ldGVyOiBvcHRpb25zLmRpYW1ldGVyIHx8IDEwMCxcclxuICAgIHN0cm9rZToge1xyXG4gICAgICB3aWR0aDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2Uud2lkdGggfHwgNDAsXHJcbiAgICAgIGdhcDogKCFvcHRpb25zLnN0cm9rZSB8fCBvcHRpb25zLnN0cm9rZS5nYXAgPT09IHVuZGVmaW5lZCkgPyAyIDogb3B0aW9ucy5zdHJva2UuZ2FwXHJcbiAgICB9LFxyXG4gICAgc2hhZG93OiB7XHJcbiAgICAgIHdpZHRoOiAoIW9wdGlvbnMuc2hhZG93IHx8IG9wdGlvbnMuc2hhZG93LndpZHRoID09PSBudWxsKSA/IDQgOiBvcHRpb25zLnNoYWRvdy53aWR0aFxyXG4gICAgfSxcclxuICAgIGFuaW1hdGlvbjoge1xyXG4gICAgICBkdXJhdGlvbjogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uIDogMTc1MCxcclxuICAgICAgZGVsYXk6IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5ICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmFuaW1hdGlvbi5kZWxheSA6IDIwMFxyXG4gICAgfSxcclxuICAgIG1pbjogb3B0aW9ucy5taW4gfHwgMCxcclxuICAgIG1heDogb3B0aW9ucy5tYXggfHwgMTAwLFxyXG4gICAgcm91bmQ6IG9wdGlvbnMucm91bmQgIT09IHVuZGVmaW5lZCA/ICEhb3B0aW9ucy5yb3VuZCA6IHRydWUsXHJcbiAgICBzZXJpZXM6IG9wdGlvbnMuc2VyaWVzIHx8IFtdLFxyXG4gICAgY2VudGVyOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlcihvcHRpb25zLmNlbnRlcilcclxuICB9O1xyXG5cclxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcclxuICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gX29wdGlvbnMuc2VyaWVzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICB2YXIgaXRlbSA9IG9wdGlvbnMuc2VyaWVzW2ldO1xyXG5cclxuICAgIC8vIGNvbnZlcnQgbnVtYmVyIHRvIG9iamVjdFxyXG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xyXG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcclxuICAgIH1cclxuXHJcbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XHJcbiAgICAgIGluZGV4OiBpLFxyXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcclxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxyXG4gICAgICBjb2xvcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvcihpdGVtLmNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIF9vcHRpb25zO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNvbG9yIHByb3BlcnR5XHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0gY29sb3JcclxuICogQGV4YW1wbGUgJyNmZTA4YjUnXHJcbiAqIEBleGFtcGxlIHsgc29saWQ6ICcjZmUwOGI1JywgYmFja2dyb3VuZDogJyMwMDAwMDAnIH1cclxuICogQGV4YW1wbGUgWycjMDAwMDAwJywgJyNmZjAwMDAnXVxyXG4gKiBAZXhhbXBsZSB7XHJcbiAgICAgICAgICAgICAgICBsaW5lYXJHcmFkaWVudDogeyB4MTogJzAlJywgeTE6ICcxMDAlJywgeDI6ICc1MCUnLCB5MjogJzAlJ30sXHJcbiAgICAgICAgICAgICAgICBzdG9wczogW1xyXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxyXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9XHJcbiAqIEBleGFtcGxlIHtcclxuICAgICAgICAgICAgICAgIHJhZGlhbEdyYWRpZW50OiB7Y3g6ICc2MCcsIGN5OiAnNjAnLCByOiAnNTAnfSxcclxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXHJcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH1cclxuICpcclxuICovXHJcblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcikge1xyXG5cclxuICBpZiAoIWNvbG9yKSB7XHJcbiAgICBjb2xvciA9IHtzb2xpZDogZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKX07XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XHJcbiAgICBjb2xvciA9IHtzb2xpZDogY29sb3J9O1xyXG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb2xvcikpIHtcclxuICAgIGNvbG9yID0ge2ludGVycG9sYXRlOiBjb2xvcn07XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdvYmplY3QnKSB7XHJcbiAgICBpZiAoIWNvbG9yLnNvbGlkICYmICFjb2xvci5pbnRlcnBvbGF0ZSAmJiAhY29sb3IubGluZWFyR3JhZGllbnQgJiYgIWNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XHJcbiAgICAgIGNvbG9yLnNvbGlkID0gZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFZhbGlkYXRlIGludGVycG9sYXRlIHN5bnRheFxyXG4gIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xyXG4gICAgaWYgKGNvbG9yLmludGVycG9sYXRlLmxlbmd0aCAhPT0gMikge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVycG9sYXRlIGFycmF5IHNob3VsZCBjb250YWluIHR3byBjb2xvcnMnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFZhbGlkYXRlIGdyYWRpZW50IHN5bnRheFxyXG4gIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xyXG4gICAgaWYgKCFjb2xvci5zdG9wcyB8fCAhQXJyYXkuaXNBcnJheShjb2xvci5zdG9wcykgfHwgY29sb3Iuc3RvcHMubGVuZ3RoICE9PSAyKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignZ3JhZGllbnQgc3ludGF4IGlzIG1hbGZvcm1lZCcpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gU2V0IGJhY2tncm91bmQgd2hlbiBpcyBub3QgcHJvdmlkZWRcclxuICBpZiAoIWNvbG9yLmJhY2tncm91bmQpIHtcclxuICAgIGlmIChjb2xvci5zb2xpZCkge1xyXG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc29saWQ7XHJcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XHJcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5pbnRlcnBvbGF0ZVswXTtcclxuICAgIH0gZWxzZSBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcclxuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gY29sb3I7XHJcblxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjZW50ZXIgcHJvcGVydHlcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8RnVuY3Rpb258T2JqZWN0fSBjZW50ZXJcclxuICogQGV4YW1wbGUgJ2ZvbyBiYXInXHJcbiAqIEBleGFtcGxlIHsgY29udGVudDogJ2ZvbyBiYXInLCB4OiAxMCwgeTogNCB9XHJcbiAqIEBleGFtcGxlIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31cclxuICogQGV4YW1wbGUgWydmb28gYmFyJywgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fV1cclxuICovXHJcblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyID0gZnVuY3Rpb24gKGNlbnRlcikge1xyXG4gIGlmICghY2VudGVyKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgLy8gQ29udmVydCB0byBvYmplY3Qgbm90YXRpb25cclxuICBpZiAoY2VudGVyLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcclxuICAgIGNlbnRlciA9IHtjb250ZW50OiBjZW50ZXJ9O1xyXG4gIH1cclxuXHJcbiAgLy8gRGVmYXVsdHNcclxuICBjZW50ZXIuY29udGVudCA9IGNlbnRlci5jb250ZW50IHx8IFtdO1xyXG4gIGNlbnRlci54ID0gY2VudGVyLnggfHwgMDtcclxuICBjZW50ZXIueSA9IGNlbnRlci55IHx8IDA7XHJcblxyXG4gIC8vIENvbnZlcnQgY29udGVudCB0byBhcnJheSBub3RhdGlvblxyXG4gIGlmICghQXJyYXkuaXNBcnJheShjZW50ZXIuY29udGVudCkpIHtcclxuICAgIGNlbnRlci5jb250ZW50ID0gW2NlbnRlci5jb250ZW50XTtcclxuICB9XHJcblxyXG4gIHJldHVybiBjZW50ZXI7XHJcbn07XHJcblxyXG4vLyBMaW5lYXIgb3IgUmFkaWFsIEdyYWRpZW50IGludGVybmFsIG9iamVjdFxyXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50ID0gKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBHcmFkaWVudCgpIHtcclxuICB9XHJcblxyXG4gIEdyYWRpZW50LnRvU1ZHRWxlbWVudCA9IGZ1bmN0aW9uIChpZCwgb3B0aW9ucykge1xyXG4gICAgdmFyIGdyYWRpZW50VHlwZSA9IG9wdGlvbnMubGluZWFyR3JhZGllbnQgPyAnbGluZWFyR3JhZGllbnQnIDogJ3JhZGlhbEdyYWRpZW50JztcclxuICAgIHZhciBncmFkaWVudCA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoZDMubnMucHJlZml4LnN2ZywgZ3JhZGllbnRUeXBlKSlcclxuICAgICAgLmF0dHIob3B0aW9uc1tncmFkaWVudFR5cGVdKVxyXG4gICAgICAuYXR0cignaWQnLCBpZCk7XHJcblxyXG4gICAgb3B0aW9ucy5zdG9wcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9wQXR0cnMpIHtcclxuICAgICAgZ3JhZGllbnQuYXBwZW5kKFwic3ZnOnN0b3BcIikuYXR0cihzdG9wQXR0cnMpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5iYWNrZ3JvdW5kID0gb3B0aW9ucy5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xyXG5cclxuICAgIHJldHVybiBncmFkaWVudC5ub2RlKCk7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIEdyYWRpZW50O1xyXG59KSgpO1xyXG5cclxuLy8gRGVmYXVsdCBjb2xvcnMgaXRlcmF0b3JcclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvciA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG4gIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTID0gW1wiIzFhZDVkZVwiLCBcIiNhMGZmMDNcIiwgXCIjZTkwYjNhXCIsICcjZmY5NTAwJywgJyMwMDdhZmYnLCAnI2ZmY2MwMCcsICcjNTg1NmQ2JywgJyM4ZThlOTMnXTtcclxuXHJcbiAgZnVuY3Rpb24gQ29sb3JzSXRlcmF0b3IoKSB7XHJcbiAgICB0aGlzLmluZGV4ID0gMDtcclxuICB9XHJcblxyXG4gIENvbG9yc0l0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYgKHRoaXMuaW5kZXggPT09IENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLmluZGV4ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlNbdGhpcy5pbmRleCsrXTtcclxuICB9O1xyXG5cclxuICByZXR1cm4gQ29sb3JzSXRlcmF0b3I7XHJcbn0pKCk7XHJcblxyXG5cclxuLy8gRXhwb3J0IFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKW1vZHVsZS5leHBvcnRzID0gUmFkaWFsUHJvZ3Jlc3NDaGFydDtcclxuIl19
