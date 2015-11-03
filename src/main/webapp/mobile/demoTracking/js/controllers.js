angular.module('tracking')

/* Filter used to get description for the given language or the first in case the given does not exist. */
.filter('localizedDescription', function(){
    return function(description, lang) {
        if (description) {
            var languages = Object.keys(description);

            if (description[lang]) {
                return description[lang];
            }
            else if (languages.length > 0) {
                return description[languages[0]];
            }
        }
        return "";
    };
})

.directive('mbAutoFocus', ['app', '$timeout', function(app, $timeout) {
    return {
        restrict: 'A',
        link: {
            post: function(scope, element, attrs) {
                scope.$watch(attrs.mbAutoFocus, function(val) {
                    if(angular.isDefined(val) && val) {
                        $timeout( function () {
                            element[0].focus();
                            element[0].select();
                            app.deviceInterface().hideKeyboard();
                        });
                    }
                });
            }
        }
    };
}])

.constant('ITEM_TYPE_CONTAINER', 1)
.constant("ITEM_TYPE_CARGO", 2)

.controller('DefaultController', ['$scope', '$translate', '$timeout', 'app', function ($scope, $translate, $timeout, app) {

    var scanningTimer;

    $scope.lang = 'en-GB';
    $scope.showBarcodeScan = app.showBarcodeScanButton();

    $scope.globalLabelsUpdate = function() {
        $scope.globalLabels = {
            Ok: $translate('globalLabels.ok'),
            Next: $translate('globalLabels.next'),
            Back: $translate('globalLabels.back'),
            Send: $translate('globalLabels.send')
        };
    };

    $scope.$on('$translateChangeSuccess', function() {
        $scope.lang = $translate.uses();
        $scope.description = app.getOrderByDescription().replace('{0}', $scope.lang);
        $scope.globalLabelsUpdate();
    });

    $scope.globalLabelsUpdate();

    $scope.scanCode = function(){
        /* Fix so that the webview has time to process changes in layout. */
        scanningTimer = $timeout(function(){
            app.scanBarcode();
            scanningTimer = undefined;
        }, 300);
    };
}])

.controller('TrackingController',
    ['$scope', '$location', '$translate', 'app', 'userId', 'deviceId', '$timeout', 'ITEM_TYPE_CONTAINER', 'ITEM_TYPE_CARGO',
    function ($scope, $location, $translate, app, userId, deviceId, $timeout, itemTypeContainer, itemTypeCargo) {

    var alertTimer;

    /* Main function that takes care of starting the page variables according
     * to the information we gather from the device. */
    $scope.initController = function() {

        /* Fix for android devices that do not have CustomEvent defined. */
        if (typeof CustomEvent === 'undefined') {
            CustomEvent = function(type, eventInitDict) {
                var event = document.createEvent('CustomEvent');

                event.initCustomEvent(type, eventInitDict['bubbles'], eventInitDict['cancelable'], eventInitDict['detail']);
                return event;
            };
        }

        $scope.focus = true;
        $scope.sendItems = true;
        $scope.mode = "read-code";
        $scope.locationItems = [];
        $scope.currentLocation = {};
        $scope.selectLocation = {};
        $scope.locationItem = {};
        $scope.updateTrackingLanguage();

        /* Attendee demo vars */
        if(app.getQueryString("demo")){
            $scope.isDemo = true;
            $scope.demo = {
                parentMovementId: app.getQueryString("movementid"),
                orderId: app.getQueryString("orderid")
            };
        }

        /* This makes the page scroll so that the selected input is always visible to the user when
         * the keyboard is opened. */
        angular.element(window).on('keyboardopen', function(e) {
            var data = JSON.parse(e.detail);
            var activeInput = document.activeElement;

            if(activeInput) {
                if($scope.previousInputId !== activeInput.id) {
                    $scope.previousScrollTop = 0;
                    $scope.previousInputId = activeInput.id;
                }

                if(document.body.scrollTop !== 0) {
                    $scope.previousScrollTop = document.body.scrollTop;
                    document.body.scrollTop = 0;
                }

                angular.element(document.body).css("margin-top", "0");
                var bounds = activeInput.getBoundingClientRect();
                var bottom = bounds.top + bounds.height;
                var actualAvailableHeight = (window.innerHeight * data.availableHeight) / data.pageHeight;

                if(bottom > actualAvailableHeight) {
                    var marginTop = bottom - actualAvailableHeight;

                    if(marginTop < bounds.top) {
                        // 5 is a small margin, so the input at the beginning of the page.
                        marginTop = marginTop + 5;
                    }
                    else {
                        // 5 is a small margin, so the input is not on top of the keyboard.
                        marginTop = bounds.top - 5;
                    }
                    angular.element(document.body).css("margin-top", "-" + marginTop+ "px");
                }
            }
        });

        /* Once the keyboard is closed we go back to the previous page position. */
        angular.element(window).on('keyboardclose', function(e) {
            angular.element(document.body).css("margin-top", "0");
            document.body.scrollTop = $scope.previousScrollTop;
        });

        /* When the Go button in the android keyboard is pressed we
         * override the behaviour and move to the next input. */
        angular.element(window).on('keypress', function(e) {
            var activeInput = document.activeElement;
            var focusOn;

            if($scope.mode === "read-code" && activeInput.id !== "code") {
                focusOn = document.getElementById("code");
            }

            if($scope.mode === "location" && activeInput.id !== "location-item-number") {
                focusOn = document.getElementById("location-item-number");
            }

            if(angular.isDefined(focusOn)) {
                focusOn.focus();
                focusOn.select();
            }
        });

        /* If the back physical button is pressed we call the back function. */
        angular.element(window).on('backbuttonpressed', function(e) {
            $scope.back();
            $scope.$apply();
        });

        /* Called when a barcode is read.
         *
         * If a barcode is read on the initial screen we fill the code variable.
         * If a barcode is read on the tracking screen we will call upon the confirmLocationItem
         * with the given code.
         */
        angular.element(window).on('barcode', function(e) {
            var focusOn;
            var code = e.detail;
            console.log("barcode: " + code);

            switch ($scope.mode) {
                case "read-code":
                    if (code == "") {
                        focusOn = document.getElementById("code");
                    }
                    else {
                        $scope.code = code;
                        $scope.confirmCode(code);
                    }
                    break;

                case "location":
                    if (code == "") {
                        focusOn = document.getElementById("location-item-number");
                    }
                    else {
                        $scope.locationItem.number = code;
                        $scope.confirmLocationItem(code);
                    }
                    break;
                default: break;
            }

            if(angular.isDefined(focusOn)) {
                focusOn.focus();
                focusOn.select();
            }

            $scope.$apply();
        });

        app.deviceInterface().hidePageLoader();
    };

    /* Labels for the Tracking page. */
    $scope.updateTrackingLanguage = function() {

        $scope.labels = {
            Remove: $translate('trackingLabels.remove'),
            Count: $translate('trackingLabels.count'),
            Container: $translate('trackingLabels.container'),
            Cargo: $translate('trackingLabels.cargo'),
            Location: $translate('trackingLabels.location'),
            Scan: $translate('trackingLabels.scan'),
            Number: $translate('trackingLabels.number'),
            Tracking: $translate('trackingLabels.tracking'),
            Items: $translate('trackingLabels.items')
        };

        $scope.errorMessages = {
            LocationNotFound: $translate('errorMessages.locationNotFound'),
            LocationCannotContainItems: $translate('errorMessages.locationCannotContainItems'),
            UnableToSendItems: $translate('errorMessages.unableToSendItems'),
            ItemAlreadyOnTrackingList: $translate('errorMessages.itemAlreadyOnTrackingList')
        };

        $scope.descriptions = {
            WarningClosing: $translate('trackingDescriptions.warningClosing'),
            ReadCode: $translate('trackingDescriptions.readCode'),
            ReadItemNumber: $translate('trackingDescriptions.readItemNumber'),
            LocationCode: $translate('trackingDescriptions.locationCode'),
            SelectLocation: $translate('trackingDescriptions.selectLocation'),
            TrackItem: $translate('trackingDescriptions.trackItem'),
            InLocation: $translate('trackingDescriptions.inLocation')
        };
    };

    /* Called when the language is changed. */
    $scope.$on('$translateChangeSuccess', function() {
        $scope.updateTrackingLanguage();
    });

    /* Focuses the input with the provided id. */
    $scope.focusInput = function(id){
        var input = document.getElementById(id);
        if(input) {
            $timeout(function() {
                input.focus();
                input.select();
            }, 0);
        }
    };

    /* Called when a location is chosen to start the tracking. */
    $scope.chooseLocation = function(location){
        $scope.currentLocation = location;
        $scope.mode = "location";
        $scope.locationTrackCount = 0;
    };

    /* Checks if a location with the given code exists and shows the tracking screen. */
    $scope.confirmCode = function(code) {
        var previousMode = $scope.mode;

        if(!angular.isDefined(code)) {
            return null;
        }

        code = code.trim();
        var location = JSON.parse(app.deviceInterface().getLocation(code));

        if(location.id) {
            $scope.chooseLocation(location);
        }
        else {
            $scope.focusInput("code");
        }

        if(previousMode !== $scope.mode){
            $scope.hideAlert();
        }
    };

    /* Checks if an item number already exists in the location items array. */
    $scope.hasItem = function(item) {
        var repeatedItem;
        var listLength = $scope.locationItems.length;
        for(var i = 0; i < listLength; i++){
            if(($scope.locationItems[i].id === item.id || $scope.locationItems[i].number === item.number) &&
                $scope.locationItems[i].itemType === item.itemType){
                repeatedItem = $scope.locationItems[i];
                break;
            }
        }
        return repeatedItem;
    };

    /* Selects or de-selects the chosen item. */
    $scope.setSelected = function(item) {
        if(item.checked){
            item.checked = !item.checked;
        }
        else {
            item.checked = true;
        }
    };

    /* Adds an item to the location items list if it isn't there already and focuses the input. */
    $scope.addItem = function(item){
        var repeatedItem = $scope.hasItem(item);

        if(angular.isUndefined(repeatedItem)){
            $scope.locationTrackCount ++;
            $scope.locationItems.push(item);
            $scope.locationItem = {number: ""};

            $scope.hideAlert();
        }
        else{
            $scope.showAlert('error', $scope.errorMessages.ItemAlreadyOnTrackingList);
        }

        $scope.focusInput("location-item-number");
    };

    /* Checks if a container or cargo with the given number exists and adds it to the location items. */
    $scope.confirmLocationItem = function(itemNumber) {

        if(!angular.isDefined(itemNumber)) {
            return null;
        }

        var container = JSON.parse(app.deviceInterface().getContainer(itemNumber));
        var cargo = JSON.parse(app.deviceInterface().getCargo(itemNumber));

        container.itemType = itemTypeContainer;
        cargo.itemType = itemTypeCargo;

        if(container.id) {
            $scope.addItem(container);
        }
        else if(cargo.id){
            $scope.addItem(cargo);
        }
    };

    /* Removes all the checked items from the location items. */
    $scope.removeLocationItems = function(locationItems) {
        for(var i=0; i < locationItems.length; i++){
            if(locationItems[i].checked) {
                $scope.locationTrackCount--;
                locationItems.splice(i, 1);
                i--;
            }
        }
        $scope.locationItems = locationItems;
    };

    /* Returns to the current Demo screen. */
    var changeBackToDemo = function(){
        var url = "../demo/index.html?userid=" + userId + "&deviceid=" + deviceId + "&orderid=" +
            $scope.demo.orderId + "&movementid=" + $scope.demo.parentMovementId;
        app.deviceInterface().showPageLoader();
        window.location.href = url;
    };

    /* Creates the tracking movements for the tracked items.
     * If we are performing a tracking within a demo it will return to the demo screen
     * Otherwise it will return to the initial screen to read a location code. */
    $scope.sendLocationItems = function(locationItems) {
        var movements = [];

        var itemsLength = locationItems.length;
        for(var i = 0; i < itemsLength; i++){
            var locationItem = locationItems[i];
            var movement = {};

            movement.movementTypeCode = "TRACKING";

            if(locationItem.containerType) {
                movement.containerId = locationItem.id;
                movement.container = locationItem;
            }
            else {
                movement.cargoId = locationItem.id;
                movement.cargo = locationItem;
            }

            movement.createUserId = userId;
            movement.createDateTime = new Date();
            movement.deviceId = deviceId;
            movement.createLocationId = $scope.currentLocation.id;
            movement.createLocation = $scope.currentLocation;

            if($scope.isDemo){
                movement.orderId = $scope.demo.orderId;
            }

            movements.push(movement);
        }

        if(app.deviceInterface().createMovements(JSON.stringify(movements))){
            $scope.locationItems = [];
            if($scope.isDemo){
                changeBackToDemo();
            }
            else {
                $scope.back();
            }
        }
        else {
            alert($scope.errorMessages.UnableToSendItems);
        }
    };

    /* Clears are the state variables we hold and goes to the initial screen
     * that reads a location code. */
    var clearVarsForReadCodeMode = function(){
        $scope.sendItems = true;
        $scope.mode = "read-code";
        $scope.locationItems = [];
        $scope.currentLocation = {};
        $scope.selectLocation = {};
        $scope.code = "";
        $scope.locationItem = {};
    };

    /* If the user is on the initial screen that reads a location code
     * and we are not performing a demo, this will close the page.
     * If the user is on the initial screen and we are performing a demo
     * we will change back to the demo screen.
     * If the user was reading items to track we show a warning and if the user
     * confirms that he wants to close we go back to the initial screen. */
    $scope.back = function() {
        if($scope.mode === "read-code" && !$scope.isDemo) {
            app.backToList(false);
        }
        else if($scope.mode === "read-code" && $scope.isDemo){
            changeBackToDemo();
        }
        else if($scope.locationItems.length > 0 && $scope.mode === "location") {
            if(confirm($scope.descriptions.WarningClosing)) {
                clearVarsForReadCodeMode();
            }
        }
        else {
            clearVarsForReadCodeMode();
        }
    };

    /* Shows an alert and tells the device to play an error sound
     * The alert will close itself after 5 seconds. */
    $scope.showAlert = function(type, message) {

        if($scope.alertType === type && $scope.alertMessage === message && alertTimer){
            return null;
        }

        $scope.alertType = type;
        $scope.alertMessage = message;
        $scope.alertIsVisible = true;
        app.deviceInterface().playAlertSound();

        alertTimer = $timeout(function(){
            $scope.alertIsVisible = false;
            alertTimer = undefined;
        }, 5000);
    };

    /* Closes the alert and cancels the timer. */
    $scope.hideAlert = function() {
        $scope.alertIsVisible = false;
        if(alertTimer){
            $timeout.cancel(alertTimer);
        }

        alertTimer = undefined;
    };

    /* Starts the demo tracking controller logic. */
    $scope.initController();
}])

.controller('ErrorController', ['$scope', '$translate', 'app', 'message', function ($scope, $translate, app, errorMessage) {

    /* Checks if there is an error message to display or displays the generic error message. */
    $scope.initController = function() {
        $scope.errorLanguageUpdate();

        if(errorMessage.title && errorMessage.text) {
            if(angular.isObject(errorMessage.text)) {
                $scope.message = {
                    title: errorMessage.title,
                    text: errorMessage.text[$translate.uses()]
                };
            }
            else {
                $scope.message = errorMessage;
            }
        }
        else {
            $scope.message = {
                title: ((errorMessage.title) ? errorMessage.title : $scope.errorLabels.Title),
                text: ((errorMessage.text) ? errorMessage.text: $scope.errorLabels.Message)
            };
        }

        angular.element(window).on('backbuttonpressed', function(e) {
            $scope.back();
            $scope.$apply();
        });

        app.deviceInterface().hidePageLoader();
    };

    $scope.$on('$translateChangeSuccess', function() {
        $scope.initController();
    });

    $scope.errorLanguageUpdate = function() {
        $scope.errorLabels = {
            Title: 'errorLabels.title',
            Message: 'globalErrorMessages.unexpectedError'
        };
    };

    /* Goes back to the movement list. */
    $scope.back = function() {
        app.backToList(false);
    };

    $scope.initController();
}]);