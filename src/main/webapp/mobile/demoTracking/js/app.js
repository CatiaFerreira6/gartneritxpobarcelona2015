angular.module('tracking', ['ngRoute', 'pascalprecht.translate'])

/* Route definition within the demo plugin. If an unrecoverable
 * error occurs the user is redirected to the error page otherwise the demo template is shown. */
.config(['$routeProvider', function($routeProvider) {
    $routeProvider.
        when('/', {templateUrl: 'pages/tracking.tpl.html', controller: 'TrackingController',
            resolve: {
                userId: function(resolver) { return resolver.user(); },
                deviceId: function(resolver) { return resolver.device(); }
            }
        }).
        when('/error', {templateUrl: 'pages/error.tpl.html', controller: 'ErrorController',
            resolve: {
                message: function(resolver) { return resolver.errorMessage(); }
            }
        });
}])

/* Used to fetch the language files we have with the specified language. */
.config(['$translateProvider', function($translateProvider) {

    $translateProvider.useStaticFilesLoader({
        prefix: 'languages/',
        suffix: '.json'
    });

    $translateProvider.fallbackLanguage('en-GB');
    $translateProvider.preferredLanguage('en-GB');
}])

/* This runs when the page opens and automatically checks if the page is running in a device. */
.run(['app', function(app){
    app.checkForDevice();
}]);