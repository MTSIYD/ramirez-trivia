gen_room_code = function() {
	return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();
}

show_screen = function(screen_name) {
    console.log(screen_name);
    $(".game_screen").css("display", "none");
    $("#" + screen_name).css("display", "block");
}

lock_answer = function(socket) {
   $("#answer_input").prop("disabled", true);
   $("#lock_answer").prop("disabled", true);
   $("#lock_answer").val("LOCKED");
   socket.emit("answer_locked");
}
reset_answer_locks = function() {
   $("#answer_input").prop("disabled", false);
   $("#lock_answer").prop("disabled", false);
   $("#lock_answer").val("Lock in Answer");
   $("#answer_input").val("");
}

// Main Split
join_game_player = function(socket, username, room, guid) { 
    $("#leave_game").css("display", "block");   
    socket.emit('join', {username: username, room: room, guid: guid});
    show_screen("player_game_screen");
    
    socket.on("unlock", function() {
        reset_answer_locks();
    });
    
    socket.on("lock", function() {
        lock_answer(socket);
    });
    
    timeout = null;
    post_current_answer = function() {
        socket.emit('answer_update', $("#answer_input").val())  
    }
    $("#answer_input").on("keyup", function() {
        clearTimeout(timeout);
        timeout = setTimeout(post_current_answer, 300);
    });
}

join_game_owner = function(socket, room_code) {
    $("#leave_game").css("display", "block");
    $("#import_questions").css("display", "inline-block");
    $("#start_game").css("display", "inline-block");
    
    $("#room_code").html(room_code);
    socket.emit('start_game', { gm_name: "Cookie Masterson", room_code: room_code});
    show_screen("gm_screen");
     
    socket.on("answer_locked", function(data, cb) {
        $(".player_answer_lock[guid=" + data.guid + "]").css("display", "block");
        $(".player_answer_lock[guid=" + data.guid + "]").on("click", function(){
            socket.emit("unlock", { guid: data.guid })
            $("#" + data.guid).html("")
            $("[guid=" + data.guid + "]").css("display", "none");
        });
    });   
    
    $("#import_questions").on("click", function() {
        show_screen("question_input_screen");
    });
    $("#save_questions").on("click", function() {
        show_screen("gm_screen");
    });
     
    $("#lock_all_answers").on("click", function() {
        socket.emit("lock", {})
    });
     
    function GameViewModel() {
        var self = this;

        self.questions = ko.observableArray([]);
        self.players = ko.observableArray([]);
        self.current_question = ko.observable(-1);

        socket.on("player_join", function(data, cb){
            if(!self.players().some(function(val) { return data.name == val.name; })){
                self.players.push(data);
            }
	    if(self.current_question() != -1) {
	        send_question();
	        if(self.questions()[self.current_question()].answer_shown) {
	            send_answer();
	        }
            }
        });
        
        send_question = function() {
	    $(".player_answer_points").each(function(i,val){ $(val).css("display", "none") });
            if (self.current_question() != -1 && self.current_question() < self.questions().length) {
		current = self.questions()[self.current_question()];
                socket.emit("send_question", current.question + " <small>(" + current.points + "pts)</small>")
            }
        }
        send_answer = function() {
	    $(".player_answer_points").each(function(i,val){
                pap = self.questions()[self.current_question()].player_answers.filter(function(val2){ return val2.player == $(val).attr("guid") })[0]
		$(val).html(pap ? pap.points : 0); 
                $(val).css("display", "inline-block");	
	    });
            socket.emit("send_answer", self.questions()[self.current_question()].answer)
        }
	commit_answers = function() {
	    current = self.questions()[self.current_question()];
	    $(".player_answer").each(function(i,val){
		got_it = current.answer.replace(/(\W)/g, "").toLowerCase() == $(val).html().replace(/(\W)/g, "").toLowerCase();
	        current.player_answers.push({ player: $(val).prop("id"), answer: $(val).html(), points: got_it ? current.points : 0 })
	    });
	}
        
        $("#start_game").on("click", function(){
            if (self.questions().length != 0) {
                $("#import_questions").css("display", "none");
                $("#start_game").css("display", "none");
                $("#controls").css("display", "block");
                self.current_question(0);
                send_question();
            } else {
                alert("Can't start the game without questions, silly.")
            }
        });
        
        $("#show_answer").on("click", function(){
            $("#show_answer").prop("disabled", true);
            self.questions()[self.current_question()].answer_shown = true;
            socket.emit("lock", {});		
	    commit_answers();
	    send_answer();
        });

	$("#player_info_area").on("click", ".player_answer_points", function(event) {
            if($("#points-edit_"+$(event.target).prop("guid")).length == 0) {
	       node = $(event.target);
	       node.html("<input id='points-edit_"+node.prop("guid")+"' class='form-control' style='width:3em;' type='text' value='"+node.html()+"' />");
               $("#points-edit_"+node.prop("guid")).focus();
	       $("#points-edit_"+node.prop("guid")).on("blur", function() {
                   number = parseInt($("#points-edit_"+node.prop("guid")).val().replace(/(\D)/g, ""));
                   self.questions()[self.current_question()].player_answers.filter(function(val){ return val.player == node.attr("guid") })[0].points = number;
	           node.html(number);
	       });
	    }
	});
     
        $("#previous_question").on("click", function() {
            if(self.current_question() > 0) {
                self.current_question(self.current_question() - 1);
                send_question();
            }
	    if(self.questions()[self.current_question()].answer_shown) {
	        send_answer();
	        $(".player_answer").each(function(i, val) {
		    pa = self.questions()[self.current_question()].player_answers.filter(function(val2){ return val2.player == $(val).prop("id") })[0]
		    answer = pa ? pa.answer : "[[Didn't Answer]]";
		    $(val).html(answer); 
		});
		socket.emit("lock", {})

	    } else {
	        $(".player_answer").each(function(i, val) { $(val).html(""); });
                $(".player_answer_lock").each(function(i, val) { $(val).css("display", "none"); });
	        socket.emit("unlock", {});
	    }
        });
        $("#next_question").on("click", function() {            
            if(self.current_question() < self.questions().length - 1) {
                self.current_question(self.current_question() + 1);
                send_question();
            }
	    if(self.questions()[self.current_question()].answer_shown) {
                send_answer();
	        $(".player_answer").each(function(i, val) {
		    pa = self.questions()[self.current_question()].player_answers.filter(function(val2){ return val2.player == $(val).prop("id") })[0]
		    answer = pa ? pa.answer : "[[Didn't Answer]]";
		    $(val).html(answer); 
		});
		socket.emit("lock", {})
	    } else {
	        $(".player_answer").each(function(i, val) { $(val).html(""); });
                $(".player_answer_lock").each(function(i, val) { $(val).css("display", "none"); });
                socket.emit("unlock", {});
	    }
        }); 
        
        timeout = null;
        process_questions = function() {
            self.questions.removeAll()
            raw_data = $("#question_input_box").val()
            q_arry = raw_data.split("\n\n")
            q_arry.forEach(function(val){
                part_arry = val.split("\n")
                a_question = { question: "<Missing Question>", answer: "<Missing Answer>", points: 0, answer_shown: false, player_answers: [] }
                if (part_arry[0] != undefined) {
                    a_question.question = part_arry[0]
                }
                if (part_arry[1] != undefined) {
                    a_question.answer = part_arry[1]
                }
                if (part_arry[2] != undefined) {
                    a_question.points = parseInt(part_arry[2].replace(/\D/g,''))
                }
                self.questions.push(a_question)
            });
        }
        $("#question_input_box").on("keyup", function() {
            clearTimeout(timeout);
            timeout = setTimeout(process_questions, 300);
        });

        socket.on("push_answer", function(data, cb) {
            $("#" + data.guid).html(data.answer)
        });
    }
    ko.applyBindings(new GameViewModel());

}

// Game Controls
$(document).ready(function() {
    var socket = io.connect('http://trivia.saintfactorstudios.ml/socket_space');

    socket.on('message', function(data, cb) {
        console.log(data);
    });
    
    socket.emit('get_session')
    socket.on('get_session', function(data, cb) {
        if (data.username == "Cookie Masterson") {
            join_game_owner(socket, data.room)
        } else if (data.guid) { 
            join_game_player(socket, data.username, data.room, data.guid)
        }
    });
    
    socket.on("receive_question", function(data, cb) {
        $(".question_here").each(function(i,val){ $(val).html(data); });
        $(".answer_here").each(function(i,val){ $(val).html(""); });
    });
    socket.on("receive_answer", function(data, cb) {
        $(".answer_here").each(function(i,val){ $(val).html(data); });
    });

    $("#new_btn").on("click", function(){
        room_code = gen_room_code();
        join_game_owner(socket, room_code)
    });

    $("#join_btn").on("click", function(){
        show_screen("player_connect_screen");
    });

    $('#join_game').on("click", function() {
        join_game_player(socket, $("#player_username").val(), $("#join_room_code").val().toUpperCase(), "new")
    });

    $('#leave_game').on("click", function() {
        socket.emit("leave")
        $("#leave_game").css("display", "none");
        $("#import_questions").css("display", "none");
        $("#start_game").css("display", "none");
        show_screen("start_screen")
    });
    
    $("#lock_answer").on("click", function(){
        lock_answer(socket);
    });
    
    $(".submit_on_enter").on("keypress", function(event) {
        if (event.keyCode == 13 || event.which == 13) {
            $('#join_game').click();
        }
    });
});
