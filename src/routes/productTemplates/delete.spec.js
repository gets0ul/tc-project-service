/**
 * Tests for delete.js
 */
import request from 'supertest';
import chai from 'chai';

import models from '../../models';
import server from '../../app';
import testUtil from '../../tests/util';

const expectAfterDelete = (id, err, next) => {
  if (err) throw err;
  setTimeout(() =>
  models.ProductTemplate.findOne({
    where: {
      id,
    },
    paranoid: false,
  })
    .then((res) => {
      if (!res) {
        throw new Error('Should found the entity');
      } else {
        chai.assert.isNotNull(res.deletedAt);
        chai.assert.isNotNull(res.deletedBy);

        request(server)
          .get(`/v4/projects/metadata/productTemplates/${id}`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.admin}`,
          })
          .expect(404, next);
      }
    }), 500);
};


describe('DELETE product template', () => {
  let templateId;

  beforeEach(() => testUtil.clearDb()
    .then(() => models.ProductTemplate.create({
      name: 'name 1',
      productKey: 'productKey 1',
      category: 'generic',
      subCategory: 'generic',
      icon: 'http://example.com/icon1.ico',
      brief: 'brief 1',
      details: 'details 1',
      aliases: ['product key 1', 'product_key_1'],
      template: {
        template1: {
          name: 'template 1',
          details: {
            anyDetails: 'any details 1',
          },
          others: ['others 11', 'others 12'],
        },
        template2: {
          name: 'template 2',
          details: {
            anyDetails: 'any details 2',
          },
          others: ['others 21', 'others 22'],
        },
      },
      createdBy: 1,
      updatedBy: 2,
    })).then((template) => {
      templateId = template.id;
      return Promise.resolve();
    }),
  );
  after(testUtil.clearDb);

  describe('DELETE /projects/metadata/productTemplates/{templateId}', () => {
    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .expect(403, done);
    });

    it('should return 403 for member', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .expect(403, done);
    });

    it('should return 403 for copilot', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .expect(403, done);
    });

    it('should return 403 for connect manager', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .expect(403, done);
    });

    it('should return 404 for non-existed template', (done) => {
      request(server)
        .delete('/v4/projects/metadata/productTemplates/1234')
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect(404, done);
    });

    it('should return 404 for deleted template', (done) => {
      models.ProductTemplate.destroy({ where: { id: templateId } })
        .then(() => {
          request(server)
            .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.admin}`,
            })
            .expect(404, done);
        });
    });

    it('should return 204, for admin, if template was successfully removed', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect(204)
        .end(err => expectAfterDelete(templateId, err, done));
    });

    it('should return 204, for connect admin, if template was successfully removed', (done) => {
      request(server)
        .delete(`/v4/projects/metadata/productTemplates/${templateId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
        })
        .expect(204)
        .end(err => expectAfterDelete(templateId, err, done));
    });
  });
});
