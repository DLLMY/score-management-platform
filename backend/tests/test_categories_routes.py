



class TestCategoriesRoutes:





    def test_get_categories_list(self, client, app, auth_headers):



        with app.app_context():







            response = client.get('/api/score-categories/', headers=auth_headers)




            assert response.status_code == 200

    def test_get_category_detail(self, client, app, auth_headers):



        with app.app_context():



            response = client.get('/api/score-categories/1', headers=auth_headers)






            assert response.status_code == 200 or response.status_code == 404



    def test_create_category(self, client, app, auth_headers):



        with app.app_context():

            response = client.post(



                '/api/score-categories/',




                json={'name': '测试分类', 'description': '测试描述'},



                headers=auth_headers







            )

            assert response.status_code == 200 or response.status_code == 201 or response.status_code == 400



    def test_update_category(self, client, app, auth_headers):

        with app.app_context():

            response = client.put(

                '/api/score-categories/1',

                json={'name': '更新测试'},

                headers=auth_headers

            )

            assert response.status_code == 200 or response.status_code == 404



    def test_delete_category(self, client, app, auth_headers):

        with app.app_context():

            response = client.delete('/api/score-categories/1', headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404



    def test_get_category_rules(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/score-categories/1/rules', headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404
