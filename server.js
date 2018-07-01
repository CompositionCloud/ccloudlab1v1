/*jslint es6, node, for*/

const path = require("path");
const fs = require("fs");

function createServer() {
    "use strict";
    
    const express = require("express");
    const socketIO = require("socket.io");

    const server = express();

    server.use(express.static("static"));

    server.get("/", function (req, res) {
        req = req; // JSLint2 problem
        
        res.sendFile(path.join(__dirname, "/static/html/ccloudlab1v1.html"));
    });
    
    server.get("/log_reader", function (req, res) {
        req = req; // JSLint2 problem
                
        res.sendFile(path.join(__dirname, "/static/html/ccloudlab1v1-log_reader.html"));
    });
    
    return socketIO(server.listen(3000));
}

const io = createServer();

const aux = require(path.join(__dirname, "/static/js/aux.js")).aux;
const scores = require(path.join(__dirname, "/static/js/scores.js")).scores;
const score_types = require(path.join(__dirname, "/static/js/types.js")).score_types;

let ccloudlab1v1 = {state: "waiting", clock: "0", log: "ccloudlab1v1-log"};
let performers = ["", "", ""];

io.on("connection", function connection(socket) {
    "use strict";
    
    let index;
        
    function loadMonitor() {
        socket.emit("load monitor", ccloudlab1v1.clock);
        
        if (ccloudlab1v1.state !== "waiting") {
            performers.forEach(function updatePerformer(performer, index) {
                socket.emit("update monitor", index, performer.state, aux.eventsToLog(performer));
            });
        }
    }
    
    socket.on("load", function load() {
        if (ccloudlab1v1.state === "waiting") {
            socket.emit("new performer");
        } else {
            index = "monitor";
            
            loadMonitor();
        }
    });
    
    socket.on("new performer", function newPerformer(performer_index) {
        if (performer_index === "monitor" || ccloudlab1v1.state !== "waiting") {
            index = "monitor";
            
            loadMonitor();
        } else {
            performer_index = parseInt(performer_index) - 1;
            
            if (performers[performer_index] !== "") {
                socket.emit("already taken");
            } else {
                index = performer_index;

                performers[index] = {state: "waiting"};

                socket.emit("confirm performer", index);
            }
        }
    });
    
    socket.on("init?", function init_() {
        let init = true;
        
        performers.forEach(function checkPerformer(performer) {
            if (performer === "") {
                init = false;
            }
        });
        
        if (init) {
            const order = aux.randomSequence(3);
            const no_pause = Math.floor(Math.random() * 2) + 1;
            
            let i;
            
            do {
                let stuck_in_loop = 0;
                
                for (i = 0; i < no_pause; i += 1) {
                    do {
                        performers[order[i]].current_event = {score: Math.floor(Math.random() * 5) + 1 + order[i] * 5};

                        if (performers[order[i]].current_event.score !== 16) { // diagram3x1
                            performers[order[i]].current_event.part = Math.floor(Math.random() * scores[performers[order[i]].current_event.score].loudness.length);
                            performers[order[i]].current_event.loudness = scores[performers[order[i]].current_event.score].loudness[performers[order[i]].current_event.part][Math.floor(Math.random() * scores[performers[order[i]].current_event.score].loudness[performers[order[i]].current_event.part].length)];
                        } else {
                            performers[order[i]].current_event.loudness = scores[performers[order[i]].current_event.score].loudness[Math.floor(Math.random() * scores[performers[order[i]].current_event.score].loudness.length)];
                        }

                        stuck_in_loop += 1;
                    } while (stuck_in_loop < 100 && (performers[order[i]].current_event.loudness > 4 || (i === 1 && Math.abs(performers[order[0]].current_event.loudness - performers[order[1]].current_event.loudness) > 1)));
                }

                if (stuck_in_loop < 100) {
                    ccloudlab1v1.state = "ready";
                }
            } while (ccloudlab1v1.state !== "ready");
            
            for (i = 2; i >= no_pause; i -= 1) {
                performers[order[i]].current_event = {score: 0, part: Math.floor(Math.random() * 3)};
            }
                                    
            performers.forEach(function initPerformer(performer, index) {
                performer.dynamic_link = "[]";
                
                score_types[scores[performer.current_event.score].type].formatEvent(performer, "current_event");
                
                io.emit("init performer", index, score_types[scores[performer.current_event.score].type].write(performer, "current_event"));
            });
        }
    });

    socket.on("begin playing", function beginPlaying() {
        io.emit("begin playing");
    });
        
    socket.on("update server", function updateServer(clock, state, log) {
        if (performers[index] === "") { // bug
            return;
        }
        
        ccloudlab1v1.clock = parseFloat(clock);
        
        const temporary_performer = Object.assign({}, performers[index]);

        aux.logToEvents(performers[index], log);

        performers[index].state = state;
                
        (function updateMonitor() {
            let update_monitor = false;

            if (temporary_performer.current_event.score !== performers[index].current_event.score || temporary_performer.current_event.part !== performers[index].current_event.part || temporary_performer.current_event.direction !== performers[index].current_event.direction || temporary_performer.current_event.loudness !== performers[index].current_event.loudness || temporary_performer.next_event_index !== performers[index].next_event_index || temporary_performer.general_loudness !== performers[index].general_loudness) {
                update_monitor = true;
            }

            if (!update_monitor) {
                let i;

                for (i = 1; i <= 3; i += 1) {
                    const next_event = "next_event_" + i;

                    if (temporary_performer[next_event].score !== performers[index][next_event].score || temporary_performer[next_event].part !== performers[index][next_event].part || temporary_performer[next_event].direction !== performers[index][next_event].direction || temporary_performer[next_event].t !== performers[index][next_event].t || temporary_performer[next_event].x !== performers[index][next_event].x || temporary_performer[next_event].loudness !== performers[index][next_event].loudness) {
                        update_monitor = true;
                        break;
                    }
                }
            }

            if (update_monitor) {
                io.emit("update monitor", index, performers[index].state, aux.eventsToLog(performers[index]));

                ccloudlab1v1.log += "\n" + clock + "| " + index + "| " + log;
            } else if (temporary_performer.state !== performers[index].state) {
                io.emit("update monitor", index, performers[index].state);
            }
        }());
        
        (function othersLoudness() {
            const temporary_others_loudness = Object.assign({}, performers[index].others_loudness);

            performers[index].others_loudness = [];

            performers.forEach(function updateLoudness(performer, performer_index) {
                if (performer_index !== index) {
                    performers[index].others_loudness.push(performer.current_event.loudness);
                }
            });

            if (!temporary_others_loudness || temporary_others_loudness[0] !== performers[index].others_loudness[0] || temporary_others_loudness[1] !== performers[index].others_loudness[1] || temporary_others_loudness[2] !== performers[index].others_loudness[2]) {
                socket.emit("others' loudness", performers[index].others_loudness.toString());
            }
        }());
        
        (function dynamicLinks() {
            let dynamic_link = [];

            function createLink(link) {
                if (performers[index].current_event.score === link.score) {
                    return;
                }

                let i;

                for (i = 1; i <= 3; i += 1) {
                    const next_event = "next_event_" + i;

                    if (i !== 2 && performers[index][next_event] !== "[]" && performers[index][next_event].score === link.score) {
                        return;
                    }
                }

                dynamic_link.push(link);
            }

            if (index === 0) {
                if (performers[1].current_event.score === 6 && performers[1].current_event.part < 5 && performers[1].current_event.loudness < 5) {
                    createLink({score: 3, part: 5, loudness: performers[1].current_event.loudness});
                }

                if (performers[1].current_event.score === 7 && performers[1].current_event.part === 11) {
                    createLink({score: 3, part: 7, loudness: performers[1].current_event.loudness - 1});
                }

                if (performers[1].current_event.score === 8 && performers[1].current_event.part === 1) {
                    createLink({score: 3, part: 10, loudness: performers[1].current_event.loudness});
                }
                
                // new
                if (performers[1].current_event.score === 9 && performers[1].current_event.part === 5) {
                    createLink({score: 4, part: 3, loudness: performers[1].current_event.loudness});
                }
                
                // new
                if (performers[1].current_event.score === 9 && performers[1].current_event.part === 13) {
                    createLink({score: 5, part: 2, loudness: performers[1].current_event.loudness});
                }

                if (performers[1].current_event.score === 10 && performers[1].current_event.part === 0) {
                    createLink({score: 1, part: 2, loudness: performers[1].current_event.loudness});
                }
                
                if (performers[2].current_event.score === 12 && performers[2].current_event.part === 6) {
                    createLink({score: 2, part: 6});
                }

                if (performers[2].current_event.score === 13 && performers[2].current_event.part === 4) {
                    createLink({score: 3, part: 11, loudness: performers[2].current_event.loudness});
                }

                if (performers[2].current_event.score === 15 && performers[2].current_event.loudness === 3) {
                    createLink({score: 1, part: 1, loudness: 4});
                }
            }

            if (index === 1) {
                if (performers[0].current_event.score === 1 && performers[0].current_event.loudness < 3) {
                    createLink({score: 10, part: 0, loudness: performers[0].current_event.loudness});
                }
                
                // new
                if (performers[0].current_event.score === 3 && performers[0].current_event.part === 3) {
                    createLink({score: 7, part: 12});
                }
                
                // new
                if (performers[0].current_event.score === 4 && performers[0].current_event.part === 3 && performers[0].current_event.loudness < 4) {
                    createLink({score: 9, part: 7, loudness: performers[0].current_event.loudness});
                }
                
                // new
                if (performers[2].current_event.score === 11 && performers[2].current_event.x > 2354) {
                    createLink({score: 6, part: 13, loudness: performers[2].current_event.loudness});
                }
                
                if (performers[2].current_event.score === 12 && performers[2].current_event.part === 10 && performers[2].current_event.t > 90) {
                    createLink({score: 9, part: 17, loudness: 4});
                }

                if (performers[2].current_event.score === 13 && performers[2].current_event.part === 0) {
                    createLink({score: 10, part: 0});
                }

                if (performers[2].current_event.score === 13 && performers[2].current_event.part === 2) {
                    createLink({score: 10, part: 1});
                }
            }

            if (index === 2) {
                if (performers[0].current_event.score === 1 && performers[0].current_event.part === 1 && performers[0].current_event.loudness === 4) {
                    createLink({score: 15, part: 0, loudness: 3});
                }

                if (performers[0].current_event.score === 2 && performers[0].current_event.part === 6) {
                    createLink({score: 12, part: 1});
                }
                
                if (performers[0].current_event.score === 3 && performers[0].current_event.part === 9 && performers[0].current_event.loudness === 2) {
                    createLink({score: 13, part: 1, loudness: 2});
                }

                if (performers[0].current_event.score === 3 && performers[0].current_event.part === 11 && performers[0].current_event.loudness < 3) {
                    createLink({score: 13, part: 4});
                }

                if (performers[0].current_event.score === 5 && performers[0].current_event.part === 0) {
                    createLink({score: 14, part: 0, loudness: 4});
                }
                
                if (performers[1].current_event.score === 6 && performers[1].current_event.part > 11 && performers[1].current_event.loudness === 2) {
                    createLink({score: 14, part: 4});
                }
                
                // new
                if (performers[1].current_event.score === 6 && performers[1].current_event.part > 11 && performers[1].current_event.loudness === 3) {
                    createLink({score: 11, x: 2485, y: 1140});
                }

                if (performers[1].current_event.score === 7 && performers[1].current_event.part < 11 && performers[1].current_event.loudness === 4) {
                    createLink({score: 15, part: 0, loudness: 4});
                }

                if (performers[1].current_event.score === 9 && performers[1].current_event.part === 0) {
                    createLink({score: 12, part: 0});
                }
                
                // new
                if (performers[1].current_event.score === 10 && performers[1].current_event.part === 0) {
                    createLink({score: 13, part: 0});
                }
            }

            if (!dynamic_link.length) {
                performers[index].dynamic_link = "[]";
            } else {
                let change_link = true;
                
                if (performers[index].dynamic_link !== "[]") {
                    dynamic_link.forEach(function compare(link) {
                        if (performers[index].dynamic_link.score === link.score && (performers[index].dynamic_link.part === undefined || performers[index].dynamic_link.part === link.part)) {
                            change_link = false;
                        }
                    });
                }
                
                if (change_link) {
                    performers[index].dynamic_link = Object.assign({}, dynamic_link[0]);
                }
            }
            
            if (performers[index].dynamic_link !== "[]") {
                score_types[scores[performers[index].dynamic_link.score].type].formatEvent(performers[index], "dynamic_link");
                
                socket.emit("dynamic link", score_types[scores[performers[index].dynamic_link.score].type].write(performers[index], "dynamic_link"));
            } else {
                socket.emit("dynamic link", "[]");
            }
        }());
    });
                  
    socket.on("the end", function theEnd(clock) {
        if (performers[index] === "") { // bug
            return;
        }
        
        performers[index].state = "ended";
        
        ccloudlab1v1.log += "\n" + clock + "| " + index + "| " + "the end";
        
        io.emit("update monitor", index, performers[index].state);
        
        let the_end = true;
        
        performers.forEach(function didEnd(performer) {
            if (performer.state !== "ended") {
                the_end = false;
            }
        });
        
        if (the_end) {
            let date = new Date();
            let filename = date.getTime() + ".txt";
    
            fs.writeFile(path.join(__dirname, "/logs/" + filename), ccloudlab1v1.log, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("new log file: " + filename);
                }
            });
            
            io.emit("the end");
        }
    });
    
    socket.on("abort", function abort() {
        io.emit("abort");
    });
    
    socket.on("reset", function reset() {
        ccloudlab1v1 = {state: "waiting", clock: "0", log: "ccloudlab1v1-log"};
        performers = ["", "", ""];
        index = undefined;
    });
        
    socket.on("disconnect", function disconnect() {
        if (index >= 0 && index <= 2 && index !== "monitor") {
            if (ccloudlab1v1.state !== "waiting") {
                io.emit("abort");
            } else {
                performers[index] = "";
            }
        }
    });
});