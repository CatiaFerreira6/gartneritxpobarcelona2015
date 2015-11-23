function DemoReportController($scope, $locale, $filter, app) {

    /* Responsible for initializing the plugin data. */
    $scope.initialization = function() {

        $scope.demoReportParameters = {demoNumber:""};

        app.httpGET(app.routes.orders).then(function(response){
            $scope.orders = response.data.results;
        });

        $scope.demoReportLabels();
    };

    /* Sets the page labels. */
    $scope.demoReportLabels = function(){
        $scope.labels = {
            Demo: {"en-GB": "Demo", "pt-PT": "Demo", "fr-FR": "Demo"}
        };
    };

    /* Updates the current page language.*/
    $scope.$on('i18nextLanguageChange', function () {
        $scope.demoReportLabels();
    });


    /* Converts and encodes the report parameters in order to send them to the API. */
    $scope.convertParametersToURIString = function(){
        var timezone = jstz.determine();
        var reportParams = "";

        if($scope.demoReportParameters && $scope.demoReportParameters.demoNumber){
            var params = "demoNumber:" + $scope.demoReportParameters.demoNumber;
            params = params + ",timezoneid:" + timezone.name();
            reportParams = encodeURIComponent(params);
        }

        $scope.renderReport(reportParams);
    };

    /* Triggered when the user clicks on the link related with the plugin. */
    $scope.initialization();
}