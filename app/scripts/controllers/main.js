/* global app */

/**
 * Main App Controller -- Manage all emails visible in the list
 */
var refreshTimeout = null
var notificationTimeout = null

app.controller('MainCtrl', [
  '$scope', '$rootScope', '$http', 'Email', '$route', '$location', 'Favicon',
  function ($scope, $rootScope, $http, Email, $route, $location, Favicon) {
    $scope.items = []
    $scope.configOpen = false
    $scope.currentItemId = null
    $scope.notificationsSupported = 'Notification' in window
    $scope.webNotifications = window.Notification && window.Notification.permission === 'granted'
    $scope.autoShow = window.localStorage && window.localStorage.getItem('MailDev.autoShow') === '1'
    $scope.unreadItems = 0

    var countUnread = function () {
      $scope.unreadItems = $scope.items.filter(function (email) {
        return !email.read
      }).length
      Favicon.setUnreadCount($scope.unreadItems)
    }

    // Load all emails
    var loadData = function () {
      $scope.items = Email.query()
      $scope.items.$promise.then(function () {
        countUnread()
      })
    }

    $rootScope.$on('Refresh', function (e, d) {
      loadData()
    })

    $rootScope.$on('$routeChangeSuccess', function (e, route) {
      if (route.params) {
        $scope.currentItemId = route.params.itemId
      }
    })

    $rootScope.$on('newMail', function (e, newEmail) {
      // update model
      $scope.items.push(newEmail)
      countUnread()

      // update DOM at most 5 times per second
      if (!refreshTimeout) {
        refreshTimeout = setTimeout(function () {
          refreshTimeout = null
          if ($scope.autoShow === true) {
            $location.path('/email/' + newEmail.id)
          }
          $scope.$apply()
        }, 200)
      }

      // show notifications
      if (!notificationTimeout && $scope.webNotifications) {
        notificationTimeout = setTimeout(function () {
          notificationTimeout = null
        }, 2000)
        new window.Notification('MailDev', { body: newEmail.subject, icon: 'favicon.ico' })
          .addEventListener('click', function () {
            $location.path('/email/' + newEmail.id)
            $scope.$apply()
          })
      }
    })

    $rootScope.$on('deleteMail', function (e, email) {
      if (email.id === 'all') {
        $rootScope.$emit('Refresh')
        $location.path('/')
      } else {
        var idx = $scope.items.reduce(function (p, c, i) {
          if (p !== 0) return p
          return c.id === email.id ? i : 0
        }, 0)

        var nextIdx = $scope.items.length === 1 ? null : idx === 0 ? idx + 1 : idx - 1
        if (nextIdx !== null) {
          $location.path('/email/' + $scope.items[nextIdx].id)
        } else {
          $location.path('/')
        }

        $scope.items.splice(idx, 1)
        countUnread()
        $scope.$apply()
      }
    })

    // Click event handlers
    $scope.markRead = function (email) {
      email.read = true
      countUnread()
    }

    $scope.showConfig = function () {
      $scope.configOpen = !$scope.configOpen
    }

    $scope.toggleAutoShow = function () {
      $scope.autoShow = !$scope.autoShow
      if (window.localStorage) {
        window.localStorage.setItem('MailDev.autoShow', $scope.autoShow ? '1' : '0')
      }
    }

    $scope.enableNotifications = function () {
      if (window.Notification && window.Notification.permission === 'granted') {
        window.alert('To disable notifications, revoke the permissions in your browser.')
        return
      }
      window.Notification.requestPermission().then(function (permissions) {
        $scope.webNotifications = permissions === 'granted'
      }).catch(function () {
        window.alert('Unable to enable web notifications. See console for more information')
      })
      if (!window.isSecureContext && window.console) {
        console.info(
          'Web notifications can only be enabled on websites with https.\n\n' +
          'You can enable https for MailDev with self-signed certificate. See `docs/https.md`\n\n' +
          'For Firefox you can circumvent this restriction temporarily:\n' +
          'In the address bar type `about:config`, and toggle `dom.webnotifications.allowinsecure` \n' +
          'Don\'t forget to reset it again after enabling notifications in MailDev'
        )
      }
    }

    // Initialize the view
    loadData()

    $http({ method: 'GET', url: 'config' })
      .success(function (data) {
        $rootScope.config = data
        $scope.config = data
      })
  }
])

/**
 * Navigation Controller
 */

app.controller('NavCtrl', [
  '$scope', '$rootScope', '$location', 'Email',
  function ($scope, $rootScope, $location, Email) {
    $scope.refreshList = function () {
      $rootScope.$emit('Refresh')
    }

    $scope.deleteAll = function () {
      Email.delete({ id: 'all' })
    }
  }
])
