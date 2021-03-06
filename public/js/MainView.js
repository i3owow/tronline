define(function(require) {
  var $                    = require('jquery'),
      _                    = require('underscore'),
      Backbone             = require('backbone'),
      eventBus             = require('eventBus'),
      login                = require('login/loginLogic'),
      LoginView            = require('login/LoginView'),
      HomeView             = require('home/HomeView'),
      SidebarView          = require('home/SidebarView'),
      ChatView             = require('home/ChatView'),
      GameView             = require('game/GameView'),
      MultiplayerSetupView = require('create/MultiplayerSetupView'),
      NotificationView     = require('home/NotificationView');

  require('slide.jquery');

  var baseURL;
  var MainView = Backbone.View.extend({
    initialize: function() {
      baseURL = (function() {
        var PRODUCTION = 'http://www.tronline.me';
        var DEVELOPMENT = 'http://localhost';
        if (window && window.location && window.location.href) {
          var href = window.location.href;
          if (href.lastIndexOf('/') === href.length-1)
            href = href.substring(0, href.length-1);
          if (href == DEVELOPMENT)
            return DEVELOPMENT;
          else
            return PRODUCTION;
        }
        return PRODUCTION;
      })();

      var self = this;
      $.getScript('/socket.io/socket.io.js', function() {
        self.onSocketIOLoaded(io);
      });

      window.onbeforeunload = function(){
        if (self.gameView)
          return 'All progress will be lost if you refresh the page.';
      }
    },
    onSocketIOLoaded: function(io) {
      this.socket = io.connect(baseURL);
      var self = this;
      this.socket.on('connect', function() {
        console.log('Socket connected');
      });
      this.socket.on('reconnect', function() {
        console.log('Socket reconnected');
        login(self.socket, self.nickname, function() {
          // Successful
          // If login is successful after reconnect, do nothing.
        }, function() {
          // Unsuccessful
          // If login is unsuccessful after reconnect, someone else must be online with same name.
          // Redirect to main page
          console.log(window.location.href);
        });
      });
      this.socket.on('invitePlayer', function(fromNickname) {
        self.$el.append('<div class="notificationView"></div>');
        var notificationView = new NotificationView({ el: self.$('.notificationView'),
                                                      socket: self.socket, nickname: fromNickname });
      });
      this.render();
      this.nickname = null;
      eventBus.on('showLogin', function() {
        self.loginView.destroy();
        self.$el.html('');
        self.appendTitle();
        self.showLogin();
      });
      eventBus.on('showLobby', function(nickname) {
        if (nickname)
          self.nickname = nickname;
        self.loginView.destroy();
        var normal = true;
        if (self.multiplayerSetupView) {
          normal = false;
          self.multiplayerSetupView.$el.slideLeft(500, function() {
            self.multiplayerSetupView.destroy();
            delete self.multiplayerSetupView;
            self.showHome(self.nickname);
          });
        } else if (self.gameView) {
          normal = false;
          self.gameView.$el.fadeOut(500, function() {
            self.gameView.teardown();
            self.gameView.destroy();
            delete self.gameView;
            self.appendTitle();
            self.$('h1').css('margin-right', '220px');
            self.showSidebarAndChat(self.nickname);
            self.showHome(self.nickname);
          });
        }
        if (normal) {
          self.showSidebarAndChat(self.nickname);
          self.showHome(self.nickname);
        }
      });
      eventBus.on('playSinglePlayer', function() {
        self.homeView.$el.slideLeft(500, function() {
          self.homeView.destroy();
          self.sidebarView.destroy();
          self.chatView.destroy();
          self.showSinglePlayer();
        });
      });
      eventBus.on('playHeadToHead', function() {
        self.homeView.$el.slideLeft(500, function() {
          self.homeView.destroy();
          self.sidebarView.destroy();
          self.chatView.destroy();
          self.showHeadToHead();
        });
      });
      eventBus.on('createMultiplayer', function() {
        self.homeView.$el.slideLeft(500, function() {
          self.homeView.destroy();
          self.showMultiplayerSetup({ isHost: true, hostNickname: self.nickname });
        });
      });
      eventBus.on('invitePlayer', function(player) {
        var nickname = $(player).text();
        if (self.multiplayerSetupView && nickname !== self.nickname) {
          //$(player).removeClass('textGlow textGlowGreen textGlowRed').addClass('textGlowOrange');
          self.socket.emit('invitePlayer', nickname);
        } else if (nickname === self.nickname) {
          alert('You cannot invite yourself to a game!');
        } else {
          alert('You must create an online multiplayer game first!');
        }
      });
      eventBus.on('acceptInvite', function(nickname) {
        self.socket.emit('acceptInvite', nickname);
        self.homeView.$el.slideLeft(500, function() {
          self.homeView.destroy();
          self.showMultiplayerSetup({ isHost: false, hostNickname: nickname });
        });
      });
      eventBus.on('declineInvite', function(nickname) {
        self.socket.emit('declineInvite', nickname);
      });
    },
    render: function() {
      this.$el = $('.mainView');
      this.appendTitle();
      this.showLogin();
    },
    appendTitle: function() {
      this.$el.append('<h1>Tronline</h1>');
    },
    showLogin: function() {
      this.$el.append('<div class="loginView"></div>');
      var loginView = new LoginView({ el: this.$('.loginView'), socket: this.socket });
      this.loginView = loginView;
    },
    showHome: function(nickname) {
      this.$el.append('<div class="homeView"></div>');
      var homeView = new HomeView({ el: this.$('.homeView'), socket: this.socket,
                                    nickname: nickname });
      this.homeView = homeView;
    },
    showSidebarAndChat: function(nickname) {
      this.$el.append('<div class="sidebarView"></div>');
      this.$el.append('<div class="chatView"></div>');
      var sidebarView = new SidebarView({ el: this.$('.sidebarView'), socket: this.socket,
                                          nickname: nickname });
      var chatView = new ChatView({ el: this.$('.chatView'), socket: this.socket,
                                    nickname: nickname });
      this.sidebarView = sidebarView;
      this.chatView = chatView;
    },
    showSinglePlayer: function() {
      this.$el.html('');
      this.$el.append('<div class="gameView"></div>');
      var gameView = new GameView({ el: this.$('.gameView') });
      this.gameView = gameView;
    },
    showHeadToHead: function() {
      this.$el.html('');
      this.$el.append('<div class="gameView"></div>');
      var gameView = new GameView({ el: this.$('.gameView'), headToHead: true });
      this.gameView = gameView;
    },
    showMultiplayerSetup: function(options) {
      if (!this.multiplayerSetupView) {
        this.$el.append('<div class="multiplayerSetupView"></div>');
        var multiplayerSetupView = new MultiplayerSetupView({ el: this.$('.multiplayerSetupView'),
                                                              socket: this.socket, isHost: options.isHost,
                                                              hostNickname: options.hostNickname });
        this.multiplayerSetupView = multiplayerSetupView;
      }
    }
  });

  return MainView;
});