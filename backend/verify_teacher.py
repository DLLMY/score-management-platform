#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, Admin, ClassInfo, AdminClass

def check_and_update():
    with app.app_context():
        print("=" * 50)
        print("TEACHER CLASS ASSOCIATION CHECK")
        print("=" * 50)
        
        teacher = Admin.query.filter_by(username='teacher1').first()
        if not teacher:
            print("ERROR: teacher1 not found")
            return
        
        print("\nTeacher: " + teacher.username)
        print("Real Name: " + str(teacher.real_name))
        print("Current Class: " + str(teacher.class_name))
        
        target_class = ClassInfo.query.filter_by(name='25电气五年制').first()
        if not target_class:
            print("\nCreating class: 25电气五年制")
            target_class = ClassInfo(name='25电气五年制', grade='25电气')
            db.session.add(target_class)
            db.session.commit()
        
        if teacher.class_name != '25电气五年制':
            print("\nUpdating teacher class...")
            teacher.class_name = '25电气五年制'
            db.session.commit()
        
        link = AdminClass.query.filter_by(admin_id=teacher.id).first()
        if link and ClassInfo.query.get(link.class_info_id):
            link_class = ClassInfo.query.get(link.class_info_id)
            print("\nCurrent association: " + link_class.name)
        else:
            print("\nCreating association...")
            old_links = AdminClass.query.filter_by(admin_id=teacher.id).all()
            for l in old_links:
                db.session.delete(l)
            new_link = AdminClass(admin_id=teacher.id, class_info_id=target_class.id, is_primary=True)
            db.session.add(new_link)
            db.session.commit()
        
        print("\nSTATUS: SUCCESS")
        print("Teacher1 linked to 25电气五年制")
        print("=" * 50)

if __name__ == '__main__':
    check_and_update()
