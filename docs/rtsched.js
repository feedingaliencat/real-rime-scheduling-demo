console.log('js imported');

var msInterval = 50;

var canvasWidth = 1000;
var canvasHeight = 500;
var maxRows = 4;


function leastCommonMultiple(numbers) {

    function lcm(x, y) {
        return Math.abs((x * y) / gcd(x, y));
    }

    function gcd(x, y) {
        x = Math.abs(x);
        y = Math.abs(y);

        while (y) {
            var t = y;
            y = x % y;
            x = t;
        }
        return x;
    }

    result = numbers.pop();
    while (numbers.length > 0) {
        result = lcm(result, numbers.pop());
    }
    return result;
}


function getData() {
    console.log('form!');

    var data = new Array();

    $('#input_data .data_field').each(function() {
        var el = {
            name:$( this ).find( '.thread_name' ).text(),
            priority:parseInt($( this ).find( 'input.priority' ).val()),
            period:parseInt($( this ).find( 'input.period' ).val()),
            wcet:parseInt($( this ).find( 'input.wcet' ).val()),
        };

        if ((el.priority || el.priority == "0") && el.period && el.wcet) {
            el['status'] = {
                remaining:0,
                index:data.length,
            };
            data.push(el);
        }
    });
    console.log('data: ', data);

    var options = new Object();
    options['algorithm'] = $('input[name="alghorithm"]:checked').val();

    console.log('options: ', options);

    return { data:data, options:options };
}


function whoIsNext(data, options, time) {
    // check deadlines
    try {
        var whoIsReady = new Array();
        var deadlines = new Array();

        data.forEach(function(thread) {
            var deadline = !(time % thread.period);
            if (deadline) {
                console.log('deadline for ', thread.name);
                if (thread['status']['remaining'] > 0) {
                    deadlines = [thread['status']['index']];
                    throw thread;
                }
                else {
                    deadlines.push(thread['status']['index']);
                    thread['status']['remaining'] += thread.wcet;
                }
            }

            if (thread['status']['remaining'] > 0) {
                whoIsReady.push(thread);
            }
        });
    }
    catch(failingThread) {
        return {
            ok:false,
            index:failingThread['status']['index'],
            thread:failingThread,
            deadlines:deadlines
        };
    }
    if (whoIsReady.length == 0) {
        return { ok:true, idle:true, deadlines:deadlines };;
    }

    function fpsRateMonotonic() {
        winner = null;
        whoIsReady.forEach(function(thread) {
            if (winner === null || thread.priority < winner.priority) {
                winner = thread;
            }
        });
        return winner
    }

    function edf() {
        winner = null;
        whoIsReady.forEach(function(thread) {
            /*
                nextDeadline = time - time%period + period;
                distance = nextDeadlin - time;
            */
            thread['status']['deadlineDistance'] = thread.period - time%thread.period;
            if (winner === null) {
                winner = thread;
            }
            else {
                var tlife = thread['status']['deadlineDistance'];
                var wlife = winner['status']['deadlineDistance'];
                console.log(tlife, wlife);
                if (
                        winner === null ||
                        tlife < wlife ||
                        ( tlife == wlife && thread.priority < winner.priority)) {
                    winner = thread;
                }
            }
        });
        return winner
    }

    if (options['algorithm'] == 'fps_rate_monotonic') {
        winner = fpsRateMonotonic();
    }
    else if (options['algorithm'] == 'edf') {
        winner = edf();
    }
    else {
        debugger;
        throw 'Unexpected algorithm';
    }
    winner['status']['remaining']--;
    return { ok:true, index:winner['status']['index'], deadlines:deadlines };
}


function drawChart(data, options) {
    var chart = $('#chart')[0];
    var ctx = chart.getContext("2d");

    var padding = 20
    var zeroChart = { x:padding+40, y:canvasHeight-padding };
    var maxX = { x:canvasWidth-padding, y:zeroChart.y };
    var maxY = { x:zeroChart.x, y:padding };
    var xAxisHeight = maxX.x - zeroChart.x - 10;
    var yAxisHeight = zeroChart.y - maxY.y - 10;

    /* cartesian plane */
    ctx.moveTo(maxY.x, maxY.y);
    ctx.lineTo(zeroChart.x, zeroChart.y);
    ctx.lineTo(maxX.x, maxX.y);
    ctx.stroke();

    /* row names */
    var rowHeight = yAxisHeight / maxRows;

    ctx.font = '30px Arial';
    ctx.textBaseline = 'top';
    var position = maxY.y + 10;
    data.forEach(function(row) {
        ctx.fillText(row.name, padding, position + 30);
        position += rowHeight;
    });

    /* rectangles */
    var periods = new Array();
    data.forEach(function(row) { periods.push(row.period); });
    var totalTime = leastCommonMultiple(periods);

    var rectWidth = xAxisHeight / totalTime;
    var rectMargin = 16;
    var rectHeight = rowHeight - rectMargin;

    var time = 0;
    var animation = setInterval(frame, msInterval);
    function frame() {
        if (time >= totalTime) {
            var indexes = new Array();
            data.forEach(function(row) {
                indexes.push(row['status']['index']);
            });
            drawDeadlines(indexes);

            clearInterval(animation);
            $('#result p').text('OK!');
        }
        else {
            next = whoIsNext(data, options, time);
            console.log('time: ', time, '; next: ', next['index']);
            if (next['idle']) {
                ctx.fillStyle = '#CCE5FF';
                ctx.fillRect(
                    zeroChart.x + time*rectWidth,
                    maxY.y,
                    rectWidth, zeroChart.y - maxY.y - 2);
            }
            else {
                var row = maxY.y + 10 + next['index']*rowHeight;
                if (next['ok']) { ctx.fillStyle = '#00CC66'; }
                else { ctx.fillStyle = '#FF3333'; }
                ctx.fillRect(
                    zeroChart.x + time*rectWidth,
                    row,
                    rectWidth, rectHeight);
            }
            if (!next['ok']) {
                clearInterval(animation);
                $('#result p').text(
                    'Deadline non rispettata per il thread _' +
                    next['thread']['name'] + '_.');
            }
            drawDeadlines(next['deadlines']);
            time++;
        }
    }

    function drawDeadlines(indexes) {
        indexes.forEach(function(index) {
            ctx.strokeStyle = '#006666';
            ctx.lineCap="round";
            ctx.lineWidth = 4;
            ctx.moveTo(
                zeroChart.x + time*rectWidth,
                maxY.y + 12 + index*rowHeight - rectMargin/2);
            ctx.lineTo(
                zeroChart.x + time*rectWidth,
                maxY.y + (index + 1)*rowHeight + rectMargin/2 - 8);
            ctx.stroke();
        });
    }
}


function main() {
    formData = getData();

    if (formData['data'].length == 0) {
        $('#result').html('<p class="error">Nessun dato inserito</p>');
    }
    else if (!formData['options']['algorithm']) {
        $('#result').html('<p class="error">Selezionare un algoritmo</p>');
    }
    else {
        $('#result').html(
            '<canvas id="chart" width="' + canvasWidth +
            '" height="' + canvasHeight +
            '" style="border:1px solid #000000;"></canvas>' +
            '<p></p>'
        );
        drawChart(formData['data'], formData['options']);
    }

    console.log('done');
}
