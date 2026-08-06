



class TestDownloadRoutes:





    def test_download_score_template(self, client, app, auth_headers):



        with app.app_context():







            response = client.get('/api/scores/template/download', headers=auth_headers)



            assert response.status_code == 200 or response.status_code == 403











    def test_download_score_template_with_class(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/scores/template/download?class_name=test', headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 403



    def test_download_score_template_with_exam(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/scores/template/download?exam_id=1', headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 403
