angular.module('register')

/* Auto focuses the selected input and hides the keyboard.
 * Is used for the badge input in which we use the barcode reader to input the code */
.directive('mbAutoFocus', ['app', '$timeout', function(app, $timeout) {
    return {
        restrict: 'A',
        link: {
            post: function(scope, element, attrs) {
                scope.$watch(attrs.mbAutoFocus, function(val) {
                    if(angular.isDefined(val) && val) {
                        $timeout( function () {
                            element[0].focus();
                            app.deviceInterface().hideKeyboard();
                        });
                    }
                });
            }
        }
    };
}])

.controller('DefaultController', ['$scope', '$translate', '$timeout', 'app', function ($scope, $translate, $timeout, app) {

    var scanningTimer;

    /* The default language. */
    $scope.lang = 'en-GB';

    /* Whether the user has the preferences to show the scan button or not .*/
    $scope.showBarcodeScan = app.showBarcodeScanButton();

    /* The labels that are used both by the DemoController and ErrorController. */
    $scope.globalLabelsUpdate = function() {
        $scope.globalLabels = {
            Ok: $translate('globalLabels.ok'),
            Back: $translate('globalLabels.back'),
            Send: $translate('globalLabels.send')
        };
    };

    /* Here we fetch the language actually being used after the angular plugin does its work. */
    $scope.$on('$translateChangeSuccess', function() {
        $scope.lang = $translate.uses();
        $scope.globalLabelsUpdate();
    });

    $scope.globalLabelsUpdate();

    /* Called when the user clicks upon the scan button. */
    $scope.scanCode = function(){
        /* Fix so that the webview has time to process changes in layout. */
        scanningTimer = $timeout(function(){
            app.scanBarcode();
            scanningTimer = undefined;
        }, 300);
    };
}])

.controller('RegisterController', ['$scope', '$translate', 'app', 'userId', 'deviceId',
    function ($scope, $translate, app, userId, deviceId) {

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

        /* Whether we want to focus a specific input. */
        $scope.focus = true;

        /* Object that will hold the attendee registration details. */
        $scope.attendee = {};

        /* Update the page labels. */
        $scope.updateLanguage();

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

        /* Behaviour for when the physical back android button is pressed. */
        angular.element(window).on('backbuttonpressed', function(e) {
            $scope.closePage();
            $scope.$apply();
        });

        /* Called after a barcode is read. The event details contains the code that was read.
         * If a code was read we save it as the attendee badge and focus the name input. */
        angular.element(window).on('barcode', function(e) {

            if(e.detail){
                $scope.attendee.badge = e.detail;
            }

            var focusOn = document.getElementById("name");

            if(angular.isDefined(focusOn)) {
                focusOn.focus();
                focusOn.select();
            }

            $scope.$apply();
        });

        /* This is done to override the default "Go" button Android keyboard behaviour.
         *  If the "Go" button is pressed and we don't have a name, we focus that input.
         *  If we already have a name but don't have a company, we focus the company input.
         *  Otherwise we just allow the default behaviour which is to submit the form. */
        angular.element(window).on('keypress', function(e) {
            if(e.keyCode === 13){
                var focusOn;
                if($scope.attendee.badge !== "" && !$scope.attendee.name){
                    focusOn = document.getElementById("name");
                }
                else if($scope.attendee.name !== "" && !$scope.attendee.company){
                    focusOn = document.getElementById("company");
                }

                if(angular.isDefined(focusOn)) {
                    focusOn.focus();
                    focusOn.select();
                }
            }

            $scope.$apply();
        });

        app.deviceInterface().hidePageLoader();
    };

    /* Localized labels for the Register Attendee page. */
    $scope.updateLanguage = function() {
        $scope.labels = {
            Title: $translate('registerLabels.title'),
            Name: $translate('registerLabels.name'),
            Company: $translate('registerLabels.company'),
            Badge: $translate('registerLabels.badge'),
            Scan: $translate('registerLabels.scan')
        };

        $scope.errorMessages = {
            UnableToRegister: $translate('errorMessages.unableToRegister')
        };

        $scope.descriptions = {
            WarningClosing: $translate('registerDescriptions.warningClosing')
        };
    };

    /* When language is changed we refresh the labels. */
    $scope.$on('$translateChangeSuccess', function() {
        $scope.updateLanguage();
    });

    /* Creates a registered new attendee movement with the specified attendee information. */
    $scope.registerAttendee = function(attendee) {
        var movements = [];
        var movementUserFields = JSON.parse(app.deviceInterface().getUserDefinedFieldsDefinition("MOVEMENT")).fields;

        /* Update the user defined fields of the movement with the gathered info about the attendee. */
        app.setUserDefinedFieldValue(movementUserFields, "Name", attendee.name);
        app.setUserDefinedFieldValue(movementUserFields, "Company", attendee.company);
        app.setUserDefinedFieldValue(movementUserFields, "Badge", attendee.badge);

        var newMovement = {
            id: app.deviceInterface().getNextMovementId(),
            movementTypeCode: "REGISTERED_NEW_ATTENDEE",
            createUserId: userId,
            createDateTime: new Date(),
            inStatusSince: new Date(),
            endDateTime: new Date(),
            deviceId: deviceId,
            notes: attendee.notes,
            userDefinedFields: angular.copy(movementUserFields)
        };

        movements.push(newMovement);

        if(app.deviceInterface().createMovements(JSON.stringify(movements))){
            $scope.closePage();
        }
        else {
            alert($scope.errorMessages.UnableToRegister);
        }
    };

    /* Closes the mobile page. */
    $scope.closePage = function() {
        app.backToList(false);
    };

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
            $scope.closePage();
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

    /* Closes the mobile page. */
    $scope.closePage = function() {
        app.backToList(false);
    };

    $scope.initController();
}]);