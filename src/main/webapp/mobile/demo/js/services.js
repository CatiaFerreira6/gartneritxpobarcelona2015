angular.module('demo')

.factory('app', ['$location', '$window', '$translate', function($location, $window, $translate) {

    var errorMessage = { title: '', text: '' };

    /* App service interface. */
    var service = {
        currentDeviceId: null,
        currentUserId: null,
        hasDevice: false,

        /* Get the value of a query string */
        getQueryString: function (field) {
            var href = window.location.href;
            var reg = new RegExp( '[?&]' + field + '=([^&#]*)', 'i' );
            var string = reg.exec(href);
            return string ? string[1] : null;
        },
        /* Exposes the device javascript interface in a more angular way. */
        deviceInterface: function() {
            return $window.device;
        },
        /* Called when the application starts to see if it is being run in an Android device,
         * and updates the language of the labels based upon the device language. */
        checkForDevice: function() {
            service.hasDevice = angular.isDefined($window.device);
            $translate.uses(service.deviceInterface().getCurrentLocaleCode());
            $translate.refresh();

            return service.hasDevice;
        },
        getErrorMessage: function() {
            return errorMessage;
        },
        clearQueryString: function(){
            $location.search('movementid', null);
            $location.search('userid', null);
            $location.search('deviceid', null);
        },
        /* Sets an error message and moves to the error page. */
        setErrorMessage: function(title, text){
            errorMessage.title = title;
            errorMessage.text = text;
            $location.path('/error');
            service.clearQueryString();
        },
        getIntFromQueryParams: function(param, resolver, error) {
            var integer = service.getQueryString(param);

            if(angular.isDefined(integer)){
                var parsedInt = parseInt(integer, 10);
                if(isNaN(parsedInt)){
                    service.setErrorMessage(resolver, error);
                }
                else {
                    return parsedInt;
                }
            }
            else {
                service.setErrorMessage(resolver, error);
            }
        },
        getMovementIdNumber: function(resolver) {
            return service.getIntFromQueryParams('movementid', resolver, 'resolverErrors.movementParam');
        },
        getUserIdNumber: function(resolver) {
            return service.getIntFromQueryParams('userid', resolver, 'resolverErrors.userParam');
        },
        getDeviceIdNumber: function(resolver) {
            return service.getIntFromQueryParams('deviceid', resolver, 'resolverErrors.deviceParam');
        },
        backToList: function(clearMovementFromList) {
            service.deviceInterface().closeMobilePage(clearMovementFromList);
        }
    };

    return service;
}])

/* This is responsible for resolving every variable that the controllers need before opening the page and show it to the user */
.factory('resolver', ['app', function(app) {

    /* Resolver public interface */
    var service = {
        /* Tries to get the user based on the id on the query params, saves it to the app service and returns it. */
        user: function() {
            var userId = app.getUserIdNumber('resolverErrors.userTitle');

            if(userId) {
                app.currentUserId = userId;
                return userId;
            }
            else {
                app.setErrorMessage('resolverErrors.userTitle', 'resolverErrors.userParam');
                return;
            }
        },
        /* Tries to get the device based on the id on the query params, saves it to the app service and returns it. */
        device: function() {
            var deviceId = app.getDeviceIdNumber('resolverErrors.deviceTitle');

            if(deviceId) {
                app.currentDeviceId = deviceId;
                return deviceId;
            }
            else {
                app.setErrorMessage('resolverErrors.deviceTitle', 'resolverErrors.deviceParam');
                return;
            }
        },
        movement: function() {
            var movementId = app.getMovementIdNumber();
            var movement = app.deviceInterface().getMovement(movementId);
            console.log(movement);
            return angular.fromJson(movement);
        },
        errorMessage: function() {
            return app.getErrorMessage();
        }
    };
    return service;
}]);