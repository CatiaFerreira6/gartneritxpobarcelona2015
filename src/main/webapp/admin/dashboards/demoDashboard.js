function DemoDashboardController($scope, $location, $interval, $i18next, app){

    /* Vars that keep the old selfie id and old selfie documents length for performance
     * reasons. If the current selfie has the same id of the last one, we do not fetch
     * the related documents.
     */
    var oldSelfieId = 0;
    var oldSelfiesLength = 0;

    /* Fetches the latest 12 movements from the API, that are unarchived and includes the
     * movement type, update user, container and cargo references.
     * The movements are ordered by in status since date and id in descending order. */
    var fetchLatestMovements = function(){
        app.httpGET(app.routes.movements + app.routes.unarchived +
            "&include=movementtype,updateuser,container,cargo" +
            "&limit=12&offset=0&sort=instatussince:desc,id:desc").then(function(response){

            $scope.latestMovements = response.data.results;
        });
    };

    /* Fetches all the unarchived orders that have been Completed. */
    var fetchOrders = function(){
        app.httpGET(app.routes.orders + app.routes.unarchived + ",orderstatus.code:COMPLETED&include=orderstatus").then(function(response){
            $scope.orders = response.data.results;
            $scope.demoCount = $scope.orders.length;
        });
    };

    /* Fetches the latest movement that has a type included in these:
     * GIVE_NOTEBOOK, SHOW_SVG_MAP, SHOW_ROUTE_GEO_MAP, REGISTERED_NEW_ATTENDEE, SELFIE or TRACKING,
     * including the movement type, container, cargo and update user references.
     * If the last movement is of type selfie we fetch the linked documents to show the photo.
     */
    var fetchLatestMovement = function(){
        app.httpGET(app.routes.movements + app.routes.unarchived + ",movementtype.code:[GIVE_NOTEBOOK,SHOW_SVG_MAP," +
            "SHOW_ROUTE_GEO_MAP,SHOW_GEO_MAP,REGISTERED_NEW_ATTENDEE,SELFIE,TRACKING]&" +
            "limit=1&offset=0&sort=instatussince:desc,id:desc&" +
            "include=movementtype,container,cargo,updateuser").then(function(response){
            if(response.data && response.data.results && response.data.results.length){
                $scope.latestMovement = response.data.results[0];
            }

            if($scope.latestMovement && $scope.latestMovement.movementType.code === "SELFIE"){
                app.httpGET(app.routes.documents + app.routes.documentReq.linked.replace("{0}", "movement")
                    .replace("{1}", $scope.latestMovement.id) + app.routes.documentReq.photos).then(function(response) {

                    if(($scope.latestMovement && $scope.latestMovement.id !== oldSelfieId) ||
                        response.data.results.length !== oldSelfiesLength) {

                        $scope.documents = [];
                        $scope.documents = response.data.results;

                        if($scope.carouselSlides){
                            $scope.carouselSlides.length = 0;
                        }

                        $scope.carouselSlides = [];
                        for (var i = 0; i < $scope.documents.length; i++){
                            for(var j = 0; j < $scope.documents[i].files.length; j++) {
                                $scope.carouselSlides.push({
                                  image: app.routes.rootURL + app.routes.documents + app.routes.documentReq.showPicture + $scope.documents[i].files[j].id + app.routes.documentReq.thumb
                                });
                            }
                        }

                        oldSelfieId = $scope.latestMovement.id;
                        oldSelfiesLength = $scope.documents.length;

                        if(angular.isDefined($scope.documents)){
                            $scope.documents.length = 0;
                        }
                    }
                });
            }
        });
    };

    /* Responsible for calling functions to populate all the data we need
     * for the dashboard to properly work.
     */
    $scope.fetchDashboardInfo = function(){
        if(angular.isDefined($location.search().fullscreen)){
            $scope.$emit('bigDashboard', true);
        }
        else {
            $scope.$emit('bigDashboard', false);
        }

        fetchLatestMovement();
        fetchLatestMovements();
        fetchOrders();
    };

    /* Given a movement and a fieldCode it will return the fields value if it exists. */
    $scope.valueForUDF = function(movement, fieldCode){
        if(movement && movement.userDefinedFields){
            for(var i = 0; i < movement.userDefinedFields.length; i++){
                if(movement.userDefinedFields[i].code === fieldCode){
                    return movement.userDefinedFields[i].value;
                }
            }
        }
    };

    /* Holds and updates the labels displayed on the page according to the current language. */
    $scope.dashboardLanguage = function(){
        $scope.labels = {
            LatestMovements: {"en-GB": "Latest Movements","pt-PT": "Últimos Movimentos", "fr-FR": "Dérniers Mouvements"},
            LatestMovement: {"en-GB": "Last Movement","pt-PT": "Último Movimento", "fr-FR": "Dérnier Mouvement"},
            DemoCount: {"en-GB": "Demos Done Until Now","pt-PT": "Demos Concluídas","fr-FR":"Démos Fait Jusqu'ici"},
            ThankYou: {"en-GB": "Thank You", "pt-PT": "Obrigado", "fr-FR": "Merci"},
            To: {"en-GB": "To", "pt-PT": "A","fr-FR":"Pour"},
            Of: {"en-GB": "Of", "pt-PT":"De","fr-FR":"De"}
        };
    };

    /* Updates the contents of the page when the language is changed. */
    $scope.$on('i18nextLanguageChange', function () {
        $scope.dashboardLanguage();
    });

    /* Interval that is responsible for fetching dashboard info every 5 seconds. */
    var promise = $interval($scope.fetchDashboardInfo, 5000);

    /* Cancel interval on page changes */
    $scope.$on('$destroy', function(){
        if (angular.isDefined(promise)) {
            $interval.cancel(promise);
            promise = undefined;
        }
    });

    /* Initialize the dashboard. */
    $scope.fetchDashboardInfo();
    $scope.dashboardLanguage();
}