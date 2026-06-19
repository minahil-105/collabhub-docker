FROM nginx:alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom config into the image
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
