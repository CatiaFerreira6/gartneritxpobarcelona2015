angular.module('demo')

.controller('DefaultController', ['$scope', '$translate', function ($scope, $translate) {

    /* The default language. */
    $scope.lang = 'en-GB';

    /* The labels that are used both by the DemoController and ErrorController */
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
}])

.controller('DemoController', ['$scope', '$translate', 'app', 'userId', 'deviceId', 'movement',
    function ($scope, $translate, app, userId, deviceId, movement) {

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

        /* Object that will hold the demo details, like what steps were already performed. */
        $scope.demo = {};

        /* Array that will hold all the selfies the attendee wants to take. */
        $scope.demoSelfies = [];

        /* Update the page labels. */
        $scope.updateLanguage();

        /* Fetching the movements related to the attendee demo movement and
         * we check which have already been performed */
        $scope.initialMovement = angular.copy(movement);
        $scope.executedMovements = angular.fromJson(app.deviceInterface().getMovementsByOrderId($scope.initialMovement.orderId));

        if($scope.executedMovements.length){
            for(var i = 0; i < $scope.executedMovements.length; i++){
                if($scope.executedMovements[i].movementType){
                    switch ($scope.executedMovements[i].movementType.code){
                        case "SHOW_GEO_MAP":
                            $scope.demo.showGeoMap = true;
                            break;
                        case "SHOW_ROUTE_GEO_MAP":
                            $scope.demo.showRoute = true;
                            break;
                        case "SHOW_SVG_MAP":
                            $scope.demo.showSVG = true;
                            break;
                        case "GIVE_NOTEBOOK":
                            $scope.demo.giveNotebook = true;
                            break;
                        case "TRACKING":
                            $scope.demo.performTracking = true;
                            break;
                        default: break;
                    }
                }
                else {
                    console.log("movement does not have movement type");
                }
            }
        }

        /* This event is called once a picture is taken and everything we need is on the event detail property. */
        angular.element(window).on('picturetaken', function(e) {
            var picture = JSON.parse(e.detail);

            if(picture){
                $scope.createSelfie(picture);
            }
            $scope.$apply();
        });

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

        app.deviceInterface().hidePageLoader();
    };

    /* Goes to the empty container. */
    $scope.takePicture = function() {
        app.deviceInterface().takePicture();
    };

    /* Localized labels for the Demo page. */
    $scope.updateLanguage = function() {
        $scope.labels = {
            Title: $translate('demoLabels.title'),
            PerformTracking: $translate('demoLabels.performTracking'),
            ShowGeoMap: $translate('demoLabels.showGeoMap'),
            ShowRoute: $translate('demoLabels.showRoute'),
            ShowLayoutMap: $translate('demoLabels.showLayoutMap'),
            TakeSelfie: $translate('demoLabels.takeSelfie'),
            GiveNotebook: $translate('demoLabels.giveNotebook'),
            EndDemo: $translate('demoLabels.endDemo')
        };

        $scope.errorMessages = {
            UnableToPerformDemo: $translate('errorMessages.unableToPerformDemo')
        };

        $scope.descriptions = {
            WarningClosing: $translate('demoDescriptions.warningClosing')
        };
    };

    /* When language is changed we refresh the labels. */
    $scope.$on('$translateChangeSuccess', function() {
        $scope.updateLanguage();
    });

    /* Opens the tracking page with the current movement and order ids if
     * the tracking movement wasn't already created for the current welcome attendee order. */
    $scope.performTracking = function(){
        if(!$scope.demo.performTracking){
            var url = "../demoTracking/index.html?demo=true&userid=" + userId + "&deviceid=" + deviceId + "&orderid=" +
                $scope.initialMovement.orderId + "&movementid=" + $scope.initialMovement.id;
            app.deviceInterface().showPageLoader();
            window.location.href = url;
        }
    };

    /* Handles the click on the Show Geographic map button by creating a movement of the type
     * SHOW_GEO_MAP linked to the current Welcome Attendee order and demo movement. */
    $scope.showGeoMap = function(){
        if(!$scope.demo.showGeoMap){
            var movements = [];
            var movement = {};
            movement.id = app.deviceInterface().getNextMovementId();
            movement.parentMovementId = $scope.initialMovement.id;
            movement.movementTypeCode = "SHOW_GEO_MAP";
            movement.createUserId = userId;
            movement.createDateTime = new Date();
            movement.inStatusSince = new Date();
            movement.endDateTime = new Date();
            movement.orderId = $scope.initialMovement.orderId;
            movement.userDefinedFields = $scope.initialMovement.userDefinedFields;
            movement.deviceId = deviceId;
            movements.push(movement);

            if(app.deviceInterface().createMovements(JSON.stringify(movements))){
                $scope.demo.showGeoMap = true;
            }
            else {
                alert($scope.errorMessages.UnableToPerformDemo);
            }
        }
    };

    /* Handles the click on the Show Route in Geographic map button by creating a movement of the type
     * SHOW_ROUTE_GEO_MAP linked to the current Welcome Attendee order and demo movement. */
    $scope.showRoute = function(){
        if(!$scope.demo.showRoute){
            var movements = [];
            var movement = {};
            movement.id = app.deviceInterface().getNextMovementId();
            movement.parentMovementId = $scope.initialMovement.id;
            movement.movementTypeCode = "SHOW_ROUTE_GEO_MAP";
            movement.createUserId = userId;
            movement.createDateTime = new Date();
            movement.inStatusSince = new Date();
            movement.endDateTime = new Date();
            movement.orderId = $scope.initialMovement.orderId;
            movement.userDefinedFields = $scope.initialMovement.userDefinedFields;
            movement.deviceId = deviceId;
            movements.push(movement);

            if(app.deviceInterface().createMovements(JSON.stringify(movements))){
                $scope.demo.showRoute = true;
            }
            else {
                alert($scope.errorMessages.UnableToPerformDemo);
            }
        }
    };

    /* Handles the click on the Show SVG map button by creating a movement of the type
     * SHOW_SVG_MAP linked to the current Welcome Attendee order and demo movement. */
    $scope.showSVG = function(){
        if(!$scope.demo.showSVG){
            var movements = [];
            var movement = {};
            movement.id = app.deviceInterface().getNextMovementId();
            movement.parentMovementId = $scope.initialMovement.id;
            movement.movementTypeCode = "SHOW_SVG_MAP";
            movement.createUserId = userId;
            movement.createDateTime = new Date();
            movement.inStatusSince = new Date();
            movement.endDateTime = new Date();
            movement.orderId = $scope.initialMovement.orderId;
            movement.userDefinedFields = $scope.initialMovement.userDefinedFields;
            movement.deviceId = deviceId;
            movements.push(movement);

            if(app.deviceInterface().createMovements(JSON.stringify(movements))){
                $scope.demo.showSVG = true;
            }
            else {
                alert($scope.errorMessages.UnableToPerformDemo);
            }
        }
    };

    /* Handles the click on the Give Notebook button by creating a movement of the type
     * GIVE_NOTEBOOK linked to the current Welcome Attendee order and demo movement. */
    $scope.giveNotebook = function(){
        if(!$scope.demo.giveNotebook){
            var movements = [];
            var movement = {};
            movement.id = app.deviceInterface().getNextMovementId();
            movement.parentMovementId = $scope.initialMovement.id;
            movement.movementTypeCode = "GIVE_NOTEBOOK";
            movement.createUserId = userId;
            movement.createDateTime = new Date();
            movement.inStatusSince = new Date();
            movement.endDateTime = new Date();
            movement.orderId = $scope.initialMovement.orderId;
            movement.userDefinedFields = $scope.initialMovement.userDefinedFields;
            movement.deviceId = deviceId;
            movements.push(movement);

            if(app.deviceInterface().createMovements(JSON.stringify(movements))){
                $scope.demo.giveNotebook = true;
            }
            else {
                alert($scope.errorMessages.UnableToPerformDemo);
            }
        }
    };

    /* Creates a SELFIE movement and the associated document wih the picture that was taken. */
    $scope.createSelfie = function(picture){
        $scope.demo.selfieTaken = true;
        $scope.demoSelfies.push(picture);
        var date = new Date();
        var documents = [];
        var selfies = [];
        var selfieMovement = {
            id: app.deviceInterface().getNextMovementId(),
            parentMovementId: $scope.initialMovement.id,
            movementTypeCode: "SELFIE",
            createUserId: userId,
            createDateTime: date,
            inStatusSince: date,
            endDateTime: date,
            orderId: $scope.initialMovement.orderId,
            userDefinedFields: $scope.initialMovement.userDefinedFields,
            deviceId: deviceId
        };

        selfies.push(selfieMovement);

        var documentType = JSON.parse(app.deviceInterface().getDocumentTypeWithCode("PHOTO"));
        var doc = {};
        doc.userId = userId;
        doc.documentTypeId = documentType.id;
        doc.fileName = picture.fileName;
        doc.date = date;
        doc.localPath = picture.original;
        doc.movementId = selfieMovement.id;
        documents.push(doc);

        if(!app.deviceInterface().createMovements(JSON.stringify(selfies), JSON.stringify(documents))){
            alert($scope.errorMessages.UnableToPerformDemo);
        }
    };

    /* This will create an Attendee demo completed movement. */
    $scope.finishDemo = function(demo) {

        /* Create the end demo movement */
        var movements = [];
        var newMovement = {
            id: app.deviceInterface().getNextMovementId(),
            parentMovementId: $scope.initialMovement.id,
            movementTypeCode: "ATTENDEE_DEMO_COMPLETED",
            createUserId: userId,
            createDateTime: new Date(),
            inStatusSince: new Date(),
            endDateTime: new Date(),
            orderId: $scope.initialMovement.orderId,
            userDefinedFields: $scope.initialMovement.userDefinedFields,
            deviceId: deviceId,
            freeJson: angular.toJson(demo)
        };

        movements.push(newMovement);

        if(app.deviceInterface().createMovements(JSON.stringify(movements))){
            $scope.closePage();
        }
        else {
            alert($scope.errorMessages.UnableToPerformDemo);
        }
    };

    /* Closes the mobile page. */
    $scope.closePage = function() {
        app.backToList(false);
    };

    $scope.initController();
}])

.controller('ErrorController', ['$scope', '$translate', 'app', 'message',
        function ($scope, $translate, app, errorMessage) {

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
    $scope.closePage = function() {
        app.backToList(false);
    };

    $scope.initController();
}]);