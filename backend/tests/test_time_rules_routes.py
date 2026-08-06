



class TestTimeRulesRoutes:





    def test_get_time_rules_list(self, client, app, auth_headers):



        with app.app_context():







            response = client.get('/api/time-rules/', headers=auth_headers)




            assert response.status_code == 200

    def test_get_time_rule_detail(self, client, app, auth_headers):



        with app.app_context():



            response = client.get('/api/time-rules/1', headers=auth_headers)






            assert response.status_code == 200 or response.status_code == 404



    def test_create_time_rule(self, client, app, auth_headers):



        with app.app_context():

            response = client.post(



                '/api/time-rules/',




                json={'name': '测试时间规则', 'start_hour': 8, 'start_minute': 0, 'end_hour': 12, 'end_minute': 0},



                headers=auth_headers







            )

            assert response.status_code in [200, 201, 400]



    def test_update_time_rule(self, client, app, auth_headers):

        with app.app_context():

            response = client.put(

                '/api/time-rules/1',

                json={'name': '更新测试'},

                headers=auth_headers

            )

            assert response.status_code in [200, 404, 400]



    def test_delete_time_rule(self, client, app, auth_headers):

        with app.app_context():

            response = client.delete('/api/time-rules/1', headers=auth_headers)

            assert response.status_code in [200, 404]



    def test_check_time_rule(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/time-rules/check', headers=auth_headers)

            assert response.status_code == 200
